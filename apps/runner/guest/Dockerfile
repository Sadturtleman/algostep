FROM ubuntu:22.04
RUN apt-get update && DEBIAN_FRONTEND=noninteractive apt-get install -y --no-install-recommends python3.10 g++ gdb openjdk-21-jdk-headless util-linux iproute2 && rm -rf /var/lib/apt/lists/*
COPY init /init
COPY agent.py /agent.py
COPY trace.py /trace.py
COPY gdb_trace.py /gdb_trace.py
COPY JdiTrace.java /opt/tracer/JdiTrace.java
COPY SingleThreadMain.java /opt/policy/SingleThreadMain.java
COPY single-thread.c /single-thread.c
RUN gcc -O2 /single-thread.c -o /single-thread && javac /opt/policy/SingleThreadMain.java
RUN javac --add-modules jdk.jdi /opt/tracer/JdiTrace.java
RUN chmod 755 /init && mkdir -p /tmp/work /sys/fs/cgroup
