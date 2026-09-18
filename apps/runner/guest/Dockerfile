FROM ubuntu:22.04
RUN apt-get update && DEBIAN_FRONTEND=noninteractive apt-get install -y --no-install-recommends python3.10 g++ openjdk-21-jdk-headless util-linux && rm -rf /var/lib/apt/lists/*
COPY init /init
COPY agent.py /agent.py
COPY trace.py /trace.py
RUN chmod 755 /init && mkdir -p /tmp/work /sys/fs/cgroup
