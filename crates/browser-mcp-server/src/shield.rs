use std::fs;
use std::io::Write;
use std::path::PathBuf;
use std::time::{SystemTime, UNIX_EPOCH};
use serde_json::{json, Value};

pub const DEFAULT_MAX_TOKENS: usize = 2500;
pub const MAX_SPOOL_FILES: usize = 50;
pub const MAX_SPOOL_BYTES: u64 = 50 * 1024 * 1024; // 50 MB

pub struct ContextShield {
    snapshots_dir: PathBuf,
}

impl ContextShield {
    pub fn new() -> Self {
        let base = dirs_home().unwrap_or_else(|| PathBuf::from("."));
        let control_dir = base.join(".browser-control").join("snapshots");
        let snapshots_dir = if base.join(".browser-control").exists() || !base.join(".browser-mcp").exists() {
            control_dir
        } else {
            base.join(".browser-mcp").join("snapshots")
        };
        Self { snapshots_dir }
    }

    #[allow(dead_code)]
    pub fn with_dir(snapshots_dir: PathBuf) -> Self {
        Self { snapshots_dir }
    }

    /// Estimate token count using robust 4-chars-per-token heuristic
    pub fn estimate_tokens(text: &str) -> usize {
        // A standard average for English text/code/markup is ~4 characters per token
        text.len().div_ceil(4)
    }

    /// Process a string payload through Context Shield.
    /// If estimated tokens exceed max_tokens, spools full text to disk and returns
    /// a paginated slice with metadata. Otherwise returns None (unshielded).
    pub fn protect(
        &self,
        tab_id: u64,
        content: &str,
        max_tokens_override: Option<usize>,
        page_offset: usize,
        limit: usize,
    ) -> Option<Value> {
        let max_tokens = max_tokens_override.unwrap_or(DEFAULT_MAX_TOKENS);
        let est_tokens = Self::estimate_tokens(content);

        if est_tokens <= max_tokens {
            return None;
        }

        // Exceeds threshold: spool to disk
        let spool_path = self.spool_to_disk(tab_id, content).ok();

        // Paginate lines
        let all_lines: Vec<&str> = content.lines().collect();
        let total_lines = all_lines.len();
        let page_limit = if limit == 0 { 100 } else { limit };

        let content_slice: Vec<&str> = if page_offset >= total_lines {
            Vec::new()
        } else {
            all_lines
                .iter()
                .skip(page_offset)
                .take(page_limit)
                .copied()
                .collect()
        };

        let slice_str = content_slice.join("\n");

        Some(json!({
            "shielded": true,
            "total_tokens_approx": est_tokens,
            "total_lines": total_lines,
            "page_offset": page_offset,
            "limit": page_limit,
            "lines_returned": content_slice.len(),
            "spool_file": spool_path.as_ref().map(|p| p.to_string_lossy().to_string()),
            "content_slice": slice_str,
            "hint": "Full page snapshot exceeded context threshold and was saved to disk. Use `browser_search_elements` to find specific controls, or call `browser_get_page_content` with `page_offset` to paginate."
        }))
    }

    /// Save full snapshot to disk and trigger LRU cleaner
    fn spool_to_disk(&self, tab_id: u64, content: &str) -> std::io::Result<PathBuf> {
        fs::create_dir_all(&self.snapshots_dir)?;

        let timestamp = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap_or_default()
            .as_millis();

        let filename = format!("tab_{}_{}.txt", tab_id, timestamp);
        let file_path = self.snapshots_dir.join(filename);

        let mut file = fs::File::create(&file_path)?;
        file.write_all(content.as_bytes())?;
        file.flush()?;

        // Clean up old snapshots
        self.clean_lru();

        Ok(file_path)
    }

    /// Ensure snapshots directory does not exceed 50 files or 50 MB
    pub fn clean_lru(&self) {
        let entries = match fs::read_dir(&self.snapshots_dir) {
            Ok(e) => e,
            Err(_) => return,
        };

        struct FileMeta {
            path: PathBuf,
            len: u64,
            modified: SystemTime,
        }

        let mut files: Vec<FileMeta> = Vec::new();
        let mut total_size: u64 = 0;

        for entry in entries.flatten() {
            if let Ok(meta) = entry.metadata() {
                if !meta.is_file() {
                    continue;
                }
                let len = meta.len();
                total_size += len;
                let modified = meta.modified().unwrap_or(UNIX_EPOCH);
                files.push(FileMeta {
                    path: entry.path(),
                    len,
                    modified,
                });
            }
        }

        // Sort by modified time ascending (oldest first)
        files.sort_by_key(|f| f.modified);

        while files.len() > MAX_SPOOL_FILES || total_size > MAX_SPOOL_BYTES {
            if files.is_empty() {
                break;
            }
            let oldest = files.remove(0);
            let _ = fs::remove_file(&oldest.path);
            if total_size >= oldest.len {
                total_size -= oldest.len;
            } else {
                total_size = 0;
            }
        }
    }
}

impl Default for ContextShield {
    fn default() -> Self {
        Self::new()
    }
}

fn dirs_home() -> Option<PathBuf> {
    #[cfg(windows)]
    {
        std::env::var("USERPROFILE")
            .or_else(|_| std::env::var("HOME"))
            .ok()
            .map(PathBuf::from)
    }
    #[cfg(not(windows))]
    {
        std::env::var("HOME").ok().map(PathBuf::from)
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::path::Path;

    #[test]
    fn test_estimate_tokens() {
        assert_eq!(ContextShield::estimate_tokens(""), 0);
        assert_eq!(ContextShield::estimate_tokens("abcd"), 1);
        assert_eq!(ContextShield::estimate_tokens("abcdefgh"), 2);
    }

    #[test]
    fn test_context_shield_under_threshold() {
        let temp_dir = std::env::temp_dir().join("test_shield_under");
        let shield = ContextShield::with_dir(temp_dir);
        let content = "Small content";
        let res = shield.protect(1, content, Some(100), 0, 10);
        assert!(res.is_none());
    }

    #[test]
    fn test_context_shield_over_threshold() {
        let temp_dir = std::env::temp_dir().join(format!("test_shield_over_{}", std::process::id()));
        let shield = ContextShield::with_dir(temp_dir.clone());
        let content = "line 1\nline 2\nline 3\nline 4\nline 5\n"; // 35 chars -> ~9 tokens
        let res = shield.protect(42, content, Some(5), 1, 2);
        assert!(res.is_some());
        let val = res.unwrap();
        assert_eq!(val["shielded"], true);
        assert_eq!(val["total_lines"], 5);
        assert_eq!(val["page_offset"], 1);
        assert_eq!(val["limit"], 2);
        assert_eq!(val["content_slice"], "line 2\nline 3");

        let spool_path = val["spool_file"].as_str().unwrap();
        assert!(Path::new(spool_path).exists());
        let _ = fs::remove_dir_all(&temp_dir);
    }
}
