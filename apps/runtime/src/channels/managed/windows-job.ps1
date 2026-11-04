# Own exactly one QQ component process tree, even if its CLI exits before children.
param([string]$LaunchBase64 = $env:BIGFATFISH_QQ_WINDOWS_LAUNCH)
$ErrorActionPreference = 'Stop'
Add-Type -TypeDefinition @'
using System;
using System.Runtime.InteropServices;
using System.Text;
using System.Threading;
public static class QQComponentJob {
  [StructLayout(LayoutKind.Sequential)] struct STARTUPINFO { public int cb; public IntPtr reserved, desktop, title; public int x,y,xSize,ySize,xChars,yChars,fill,flags; public short show,reserved2; public IntPtr reservedPtr,input,output,error; }
  [StructLayout(LayoutKind.Sequential)] struct PROCESS_INFORMATION { public IntPtr process,thread; public uint processId,threadId; }
  [StructLayout(LayoutKind.Sequential)] struct BASIC_LIMIT { public long processTime,jobTime; public uint flags; public UIntPtr min,max; public uint active; public UIntPtr affinity; public uint priority,scheduling; }
  [StructLayout(LayoutKind.Sequential)] struct IO_COUNTERS { public ulong readOps,writeOps,otherOps,readBytes,writeBytes,otherBytes; }
  [StructLayout(LayoutKind.Sequential)] struct EXTENDED_LIMIT { public BASIC_LIMIT basic; public IO_COUNTERS io; public UIntPtr processMemory,jobMemory,peakProcess,peakJob; }
  [DllImport("kernel32.dll", CharSet=CharSet.Unicode, SetLastError=true)] static extern IntPtr CreateJobObject(IntPtr security, string name);
  [DllImport("kernel32.dll", SetLastError=true)] static extern bool SetInformationJobObject(IntPtr job, int type, IntPtr value, uint length);
  [DllImport("kernel32.dll", CharSet=CharSet.Unicode, SetLastError=true)] static extern bool CreateProcess(string app, StringBuilder command, IntPtr pa, IntPtr ta, bool inherit, uint flags, IntPtr env, string cwd, ref STARTUPINFO startup, out PROCESS_INFORMATION info);
  [DllImport("kernel32.dll", SetLastError=true)] static extern bool AssignProcessToJobObject(IntPtr job, IntPtr process);
  [DllImport("kernel32.dll")] static extern IntPtr GetStdHandle(int value);
  [DllImport("kernel32.dll")] static extern uint ResumeThread(IntPtr thread);
  [DllImport("kernel32.dll")] static extern uint WaitForSingleObject(IntPtr handle, uint timeout);
  [DllImport("kernel32.dll")] static extern bool GetExitCodeProcess(IntPtr process, out uint code);
  [DllImport("kernel32.dll")] static extern bool TerminateProcess(IntPtr process, uint code);
  [DllImport("kernel32.dll")] static extern bool CloseHandle(IntPtr handle);
  public static int Run(string executable, string command, string cwd) {
    IntPtr job=CreateJobObject(IntPtr.Zero,null); if(job==IntPtr.Zero) throw new System.ComponentModel.Win32Exception();
    // Parent holds stdin open. Its disappearance closes the job and every owned child.
    ThreadPool.QueueUserWorkItem(_ => { try { while(Console.In.Read() != -1) {} } finally { Environment.Exit(1); } });
    PROCESS_INFORMATION pi=new PROCESS_INFORMATION();
    try {
      EXTENDED_LIMIT limit=new EXTENDED_LIMIT(); limit.basic.flags=0x2000; // JOB_OBJECT_LIMIT_KILL_ON_JOB_CLOSE
      int size=Marshal.SizeOf(limit); IntPtr memory=Marshal.AllocHGlobal(size);
      try { Marshal.StructureToPtr(limit,memory,false); if(!SetInformationJobObject(job,9,memory,(uint)size)) throw new System.ComponentModel.Win32Exception(); }
      finally { Marshal.FreeHGlobal(memory); }
      STARTUPINFO si=new STARTUPINFO(); si.cb=Marshal.SizeOf(si); si.flags=0x100; si.input=GetStdHandle(-10); si.output=GetStdHandle(-11); si.error=GetStdHandle(-12);
      if(!CreateProcess(executable,new StringBuilder(command),IntPtr.Zero,IntPtr.Zero,true,4,IntPtr.Zero,cwd,ref si,out pi)) throw new System.ComponentModel.Win32Exception();
      if(!AssignProcessToJobObject(job,pi.process)) { TerminateProcess(pi.process,1); throw new System.ComponentModel.Win32Exception(); }
      if(ResumeThread(pi.thread)==0xffffffff) throw new System.ComponentModel.Win32Exception();
      if(WaitForSingleObject(pi.process,0xffffffff)==0xffffffff) throw new System.ComponentModel.Win32Exception(); uint code; if(!GetExitCodeProcess(pi.process,out code)) throw new System.ComponentModel.Win32Exception(); return (int)code;
    } finally { CloseHandle(job); if(pi.thread!=IntPtr.Zero) CloseHandle(pi.thread); if(pi.process!=IntPtr.Zero) CloseHandle(pi.process); }
  }
}
'@
try {
  $launch = [Text.Encoding]::UTF8.GetString([Convert]::FromBase64String($LaunchBase64)) | ConvertFrom-Json
  exit [QQComponentJob]::Run($launch.executable, $launch.command, $launch.cwd)
} catch { [Console]::Error.WriteLine('QQ_COMPONENT_START_FAILED'); exit 1 }
