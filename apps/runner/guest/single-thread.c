#include <errno.h>
#include <linux/audit.h>
#include <linux/filter.h>
#include <linux/seccomp.h>
#include <stddef.h>
#include <stdio.h>
#include <sys/prctl.h>
#include <sys/syscall.h>
#include <unistd.h>
// Guest-only x86_64 exec wrapper. The filter survives exec and cannot be removed.
int main(int argc,char **argv) {
  struct sock_filter filter[]={
    BPF_STMT(BPF_LD|BPF_W|BPF_ABS,offsetof(struct seccomp_data,arch)),
    BPF_JUMP(BPF_JMP|BPF_JEQ|BPF_K,AUDIT_ARCH_X86_64,1,0),
    BPF_STMT(BPF_RET|BPF_K,SECCOMP_RET_KILL_PROCESS),
    BPF_STMT(BPF_LD|BPF_W|BPF_ABS,offsetof(struct seccomp_data,nr)),
    BPF_JUMP(BPF_JMP|BPF_JGE|BPF_K,0x40000000,0,1),
    BPF_STMT(BPF_RET|BPF_K,SECCOMP_RET_KILL_PROCESS),
    BPF_JUMP(BPF_JMP|BPF_JEQ|BPF_K,__NR_clone,4,0),
    BPF_JUMP(BPF_JMP|BPF_JEQ|BPF_K,__NR_clone3,3,0),
    BPF_JUMP(BPF_JMP|BPF_JEQ|BPF_K,__NR_fork,2,0),
    BPF_JUMP(BPF_JMP|BPF_JEQ|BPF_K,__NR_vfork,1,0),
    BPF_STMT(BPF_RET|BPF_K,SECCOMP_RET_ALLOW),
    BPF_STMT(BPF_RET|BPF_K,SECCOMP_RET_ERRNO|EPERM)
  };
  struct sock_fprog p={.len=sizeof(filter)/sizeof(filter[0]),.filter=filter};
  if(argc<2||prctl(PR_SET_NO_NEW_PRIVS,1,0,0,0)||prctl(PR_SET_SECCOMP,SECCOMP_MODE_FILTER,&p)){perror("single-thread policy");return 126;}
  execvp(argv[1],argv+1);perror("exec");return 127;
}
