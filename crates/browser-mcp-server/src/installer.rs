use std::path::PathBuf;
use include_dir::{include_dir, Dir};

static EXTENSION_DIR: Dir = include_dir!("$CARGO_MANIFEST_DIR/../../extension");

pub fn run_install() -> Result<(), Box<dyn std::error::Error>> {
    println!("=== Browser MCP Installer (v{}) ===", env!("CARGO_PKG_VERSION"));
    println!("Installing standalone browser automation bridge...\n");

    let home = std::env::var("USERPROFILE")
        .or_else(|_| std::env::var("HOME"))
        .unwrap_or_else(|_| ".".to_string());
    let base_dir = PathBuf::from(&home).join(".browser-mcp");
    let ext_dir = base_dir.join("extension");

    std::fs::create_dir_all(&ext_dir)?;

    println!("[1/3] Extracting embedded extension to: {}", ext_dir.display());
    EXTENSION_DIR.extract(&ext_dir)?;
    println!("      Extracted {} extension files successfully.", EXTENSION_DIR.files().count());

    let current_exe = std::env::current_exe()
        .unwrap_or_else(|_| PathBuf::from("browser-mcp"));
    let exe_str = current_exe.to_string_lossy().to_string();

    println!("\n[2/3] Registering Browser MCP server with AI assistants:");
    println!("      Executable: {}", exe_str);

    // Provide verified configuration snippets
    println!("\n  -> Claude Code registration command:");
    println!("     claude mcp add browser-mcp \"{}\"", exe_str);

    println!("\n  -> Cursor configuration (~/.cursor/mcp.json):");
    println!("     {{");
    println!("       \"mcpServers\": {{");
    println!("         \"browser-mcp\": {{");
    println!("           \"command\": \"{}\"", exe_str.replace('\\', "\\\\"));
    println!("         }}");
    println!("       }}");
    println!("     }}");

    println!("\n  -> Antigravity configuration (~/.gemini/config/mcp_config.json):");
    println!("     {{");
    println!("       \"mcpServers\": {{");
    println!("         \"browser-mcp\": {{");
    println!("           \"command\": \"{}\"", exe_str.replace('\\', "\\\\"));
    println!("         }}");
    println!("       }}");
    println!("     }}");

    println!("\n  -> Claude Desktop configuration (macOS: ~/Library/Application Support/Claude/claude_desktop_config.json, Windows: %APPDATA%\\Claude\\claude_desktop_config.json):");
    println!("     {{");
    println!("       \"mcpServers\": {{");
    println!("         \"browser-mcp\": {{");
    println!("           \"command\": \"{}\"", exe_str.replace('\\', "\\\\"));
    println!("         }}");
    println!("       }}");
    println!("     }}");

    println!("\n[3/3] Load the extension in your browser:");
    println!("      1. Open Brave (brave://extensions) or Chrome (chrome://extensions)");
    println!("      2. Turn ON 'Developer mode' (toggle in top-right corner)");
    println!("      3. Click 'Load unpacked'");
    println!("      4. Select directory: {}", ext_dir.display());

    println!("\nSetup complete! You can now launch your AI assistant to automate the browser.");
    Ok(())
}
