import com.sun.jdi.*;
import com.sun.jdi.connect.*;
import com.sun.jdi.event.*;
import com.sun.jdi.request.*;
import java.nio.file.*;
import java.nio.charset.StandardCharsets;
import java.util.*;

/** Guest-only debugger. Reads fields without invoking methods in user code. */
public class JdiTrace {
  static Set<Long> seen=new HashSet<>();
  static String quote(String s) {
    StringBuilder b=new StringBuilder("\"");
    for(char c:s.toCharArray()) {
      if(c=='"'||c=='\\') b.append('\\').append(c);
      else if(c<32)b.append(String.format("\\u%04x",(int)c));else b.append(c);
    }
    return b.append('"').toString();
  }
  static Value field(ObjectReference o,String name) {
    Field f=o.referenceType().fieldByName(name);return f==null?null:o.getValue(f);
  }
  static String value(Value v,int depth) {
    if(v==null)return "null";
    if(depth>5)return quote("[depth limit]");
    if(v instanceof StringReference s)return quote(s.value().substring(0,Math.min(s.value().length(),200)));
    if(v instanceof CharValue c)return quote(""+c.value());
    if(v instanceof PrimitiveValue)return v.toString().matches("-?[0-9]+(\\.[0-9]+)?([eE][+-]?[0-9]+)?|true|false")?v.toString():quote(v.toString());
    if(v instanceof ArrayReference a) {
      List<String> items=new ArrayList<>();for(Value x:a.getValues(0,Math.min(a.length(),30)))items.add(value(x,depth+1));return "["+String.join(",",items)+"]";
    }
    if(v instanceof ObjectReference o) {
      String type=o.referenceType().name();
      if(type.equals("java.lang.Integer")||type.equals("java.lang.Long")||type.equals("java.lang.Boolean"))return value(field(o,"value"),depth+1);
      if(type.equals("java.util.ArrayList")) {
        ArrayReference data=(ArrayReference)field(o,"elementData");IntegerValue size=(IntegerValue)field(o,"size");
        List<String> items=new ArrayList<>();for(Value x:data.getValues(0,Math.min(size.value(),30)))items.add(value(x,depth+1));return "["+String.join(",",items)+"]";
      }
      if(type.equals("java.util.ArrayDeque")) {
        ArrayReference data=(ArrayReference)field(o,"elements");int head=((IntegerValue)field(o,"head")).value(),tail=((IntegerValue)field(o,"tail")).value();
        List<String> items=new ArrayList<>();for(int i=head;i!=tail&&items.size()<30;i=(i+1)%data.length())items.add(value(data.getValue(i),depth+1));return "["+String.join(",",items)+"]";
      }
      if(!type.startsWith("java.") && !type.startsWith("jdk.") && !type.startsWith("sun.")) {
        String identity="java@"+o.uniqueID();
        if(!seen.add(o.uniqueID()))return "{\"$ref\":"+quote(identity)+"}";
        List<String> fields=new ArrayList<>();
        for(Field f:o.referenceType().allFields())if(!f.isStatic()&&fields.size()<30)fields.add(quote(f.name())+":"+value(o.getValue(f),depth+1));
        return "{\"$id\":"+quote(identity)+",\"$type\":"+quote(type)+",\"fields\":{"+String.join(",",fields)+"}}";
      }
      return quote(type+"@"+o.uniqueID());
    }
    return quote("[unavailable]");
  }
  static String capture(ThreadReference thread) throws Exception {
    seen.clear();
    StackFrame frame=thread.frame(0);Map<String,String> vars=new LinkedHashMap<>();
    for(Field f:frame.location().declaringType().allFields())if(f.isStatic()&&vars.size()<40)vars.put(f.name(),value(frame.location().declaringType().getValue(f),0));
    try { for(LocalVariable v:frame.visibleVariables())if(vars.size()<40)vars.put(v.name(),value(frame.getValue(v),0)); } catch(AbsentInformationException ignored) {}
    List<String> fields=new ArrayList<>();for(var e:vars.entrySet())fields.add(quote(e.getKey())+":"+e.getValue());
    List<String> stack=new ArrayList<>();for(StackFrame f:thread.frames())if(f.location().declaringType().name().startsWith("Main")&&stack.size()<32)stack.add(quote(f.location().method().name()));
    return "{\"line\":"+Math.max(1,frame.location().lineNumber())+",\"event\":\"line\",\"locals\":{"+String.join(",",fields)+"},\"stack\":["+String.join(",",stack)+"]}";
  }
  public static void main(String[] args) throws Exception {
    List<String> steps=new ArrayList<>();VirtualMachine vm=null;boolean truncated=false;
    try {
      LaunchingConnector connector=Bootstrap.virtualMachineManager().defaultConnector();var options=connector.defaultArguments();
      options.get("main").setValue("SingleThreadMain");
      options.get("options").setValue("-Djava.security.manager=allow -cp /opt/policy:/tmp/work -Xmx128m -XX:+UseSerialGC -XX:ActiveProcessorCount=1");
      vm=connector.launch(options);
      Process child=vm.process();child.getOutputStream().write(Files.readAllBytes(Path.of("/tmp/work/stdin")));child.getOutputStream().close();
      Thread out=new Thread(()->{try{child.getInputStream().transferTo(java.io.OutputStream.nullOutputStream());}catch(Exception ignored){}});out.setDaemon(true);out.start();
      Thread err=new Thread(()->{try{child.getErrorStream().transferTo(java.io.OutputStream.nullOutputStream());}catch(Exception ignored){}});err.setDaemon(true);err.start();
      MethodEntryRequest entry=vm.eventRequestManager().createMethodEntryRequest();entry.addClassFilter("Main*");entry.setSuspendPolicy(EventRequest.SUSPEND_EVENT_THREAD);entry.enable();
      vm.resume();boolean running=true;long deadline=System.nanoTime()+8_000_000_000L;
      while(running&&System.nanoTime()<deadline&&steps.size()<2000){
        EventSet events=vm.eventQueue().remove(500);if(events==null)continue;
        for(Event event:events){
          if(event instanceof MethodEntryEvent e && e.method().name().equals("main")){
            entry.disable();StepRequest step=vm.eventRequestManager().createStepRequest(e.thread(),StepRequest.STEP_LINE,StepRequest.STEP_INTO);step.addClassFilter("Main*");step.setSuspendPolicy(EventRequest.SUSPEND_EVENT_THREAD);step.enable();steps.add(capture(e.thread()));
          }else if(event instanceof StepEvent e){steps.add(capture(e.thread()));}
          else if(event instanceof VMDeathEvent || event instanceof VMDisconnectEvent)running=false;
        }
        events.resume();
      }
      truncated=running;
    } catch(VMDisconnectedException ignored) {} finally {
      if(vm!=null)try{vm.exit(0);}catch(Exception ignored){}
      String json="["+String.join(",",steps)+"]";
      while(json.getBytes(StandardCharsets.UTF_8).length>60000&&!steps.isEmpty()){truncated=true;steps.remove(steps.size()-1);json="["+String.join(",",steps)+"]";}
      Files.writeString(Path.of("/tmp/work/trace.json"),json);
      if(truncated)Files.writeString(Path.of("/tmp/work/trace-truncated"),"1");
    }
  }
}
