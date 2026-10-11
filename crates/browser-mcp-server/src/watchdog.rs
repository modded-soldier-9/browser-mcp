use std::time::Duration;
use sysinfo::{Pid, System};

pub struct ProcessWatchdog {
    parent_pid: u32,
    system: System,
}

impl ProcessWatchdog {
    pub fn new(parent_pid: u32) -> Self {
        let mut system = System::new_all();
        system.refresh_processes(sysinfo::ProcessesToUpdate::All);
        Self { parent_pid, system }
    }

    pub fn is_parent_alive(&mut self) -> bool {
        if self.parent_pid <= 1 {
            return true;
        }
        self.system.refresh_processes(sysinfo::ProcessesToUpdate::All);
        let pid = Pid::from_u32(self.parent_pid);
        self.system.process(pid).is_some()
    }
}

pub fn spawn_watchdog(parent_pid: u32, shutdown_tx: tokio::sync::broadcast::Sender<()>) {
    if parent_pid <= 1 {
        return;
    }
    tokio::spawn(async move {
        let mut watchdog = ProcessWatchdog::new(parent_pid);
        let mut interval = tokio::time::interval(Duration::from_secs(5));
        loop {
            interval.tick().await;
            if !watchdog.is_parent_alive() {
                eprintln!("[MCP] Parent process {} died - triggering shutdown", parent_pid);
                let _ = shutdown_tx.send(());
                break;
            }
        }
    });
}
