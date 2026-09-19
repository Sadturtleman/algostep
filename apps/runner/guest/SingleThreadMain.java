import java.security.Permission;
/** Java 21 learning policy. Firecracker remains the security isolation boundary. */
@SuppressWarnings("removal")
public class SingleThreadMain {
  static class Policy extends SecurityManager {
    public void checkAccess(ThreadGroup group) { throw new SecurityException("Algostep supports one user thread; thread groups and workers are disabled"); }
    public void checkAccess(Thread thread) { if(thread!=Thread.currentThread())throw new SecurityException("Additional user threads are disabled"); }
    public void checkExec(String command) { throw new SecurityException("Child processes are disabled"); }
    public void checkPermission(Permission permission) {
      if(permission instanceof RuntimePermission && (permission.getName().equals("setSecurityManager")||permission.getName().equals("modifyThread")||permission.getName().equals("modifyThreadGroup")))throw new SecurityException("Cannot change execution policy");
    }
  }
  public static void main(String[] args) throws Throwable {
    System.setSecurityManager(new Policy());
    try {Class.forName("Main").getMethod("main",String[].class).invoke(null,(Object)new String[0]);}
    catch(java.lang.reflect.InvocationTargetException e){throw e.getCause();}
  }
}
