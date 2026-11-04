use tokio::sync::broadcast;

/// Spawns signal listener for graceful shutdown on Ctrl-C / termination signals
pub fn spawn_signal_watchdog(shutdown_tx: broadcast::Sender<()>) {
    tokio::spawn(async move {
        let _ = tokio::signal::ctrl_c().await;
        eprintln!("[MCP] Interrupt signal received - triggering shutdown");
        let _ = shutdown_tx.send(());
    });
}
