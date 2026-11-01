use std::collections::{HashMap, HashSet};
use serde_json::{json, Value};

#[derive(Default)]
pub struct DeltaEngine {
    tab_history: HashMap<u64, Vec<String>>,
}

impl DeltaEngine {
    pub fn new() -> Self {
        Self {
            tab_history: HashMap::new(),
        }
    }

    /// Reset history for a specific tab (e.g. on navigation or closed tab)
    pub fn reset_tab(&mut self, tab_id: u64) {
        self.tab_history.remove(&tab_id);
    }

    /// Process page snapshot content for delta format
    pub fn process_snapshot(&mut self, tab_id: u64, content: &str) -> Value {
        let current_lines: Vec<String> = content
            .lines()
            .map(|s| s.trim().to_string())
            .filter(|s| !s.is_empty())
            .collect();

        match self.tab_history.get(&tab_id) {
            None => {
                // First snapshot for this tab: treat all lines as initial state
                let diff_str = current_lines
                    .iter()
                    .map(|l| format!("+ {}", l))
                    .collect::<Vec<_>>()
                    .join("\n");

                let count = current_lines.len();
                self.tab_history.insert(tab_id, current_lines);

                json!({
                    "delta": true,
                    "is_initial": true,
                    "added_count": count,
                    "removed_count": 0,
                    "diff": diff_str
                })
            }
            Some(prev_lines) => {
                let prev_set: HashSet<&String> = prev_lines.iter().collect();
                let curr_set: HashSet<&String> = current_lines.iter().collect();

                let mut diff_lines: Vec<String> = Vec::new();
                let mut added_count = 0;
                let mut removed_count = 0;

                // Identify removed lines
                for line in prev_lines {
                    if !curr_set.contains(line) {
                        diff_lines.push(format!("- {}", line));
                        removed_count += 1;
                    }
                }

                // Identify added lines
                for line in &current_lines {
                    if !prev_set.contains(line) {
                        diff_lines.push(format!("+ {}", line));
                        added_count += 1;
                    }
                }

                let diff_str = if diff_lines.is_empty() {
                    "No mutations detected.".to_string()
                } else {
                    diff_lines.join("\n")
                };

                // Update stored snapshot
                self.tab_history.insert(tab_id, current_lines);

                json!({
                    "delta": true,
                    "is_initial": false,
                    "added_count": added_count,
                    "removed_count": removed_count,
                    "diff": diff_str
                })
            }
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_delta_initial() {
        let mut engine = DeltaEngine::new();
        let content = "[e1] button 'Save'\n[e2] link 'Cancel'";
        let res = engine.process_snapshot(1, content);
        assert_eq!(res["delta"], true);
        assert_eq!(res["is_initial"], true);
        assert_eq!(res["added_count"], 2);
        assert_eq!(res["removed_count"], 0);
        assert!(res["diff"].as_str().unwrap().contains("+ [e1] button 'Save'"));
    }

    #[test]
    fn test_delta_subsequent_diff() {
        let mut engine = DeltaEngine::new();
        engine.process_snapshot(1, "[e1] button 'Save'\n[e2] link 'Cancel'");

        // Mutation: [e2] removed, [e3] added
        let next = "[e1] button 'Save'\n[e3] button 'Submit'";
        let res = engine.process_snapshot(1, next);
        assert_eq!(res["delta"], true);
        assert_eq!(res["is_initial"], false);
        assert_eq!(res["added_count"], 1);
        assert_eq!(res["removed_count"], 1);

        let diff = res["diff"].as_str().unwrap();
        assert!(diff.contains("- [e2] link 'Cancel'"));
        assert!(diff.contains("+ [e3] button 'Submit'"));
    }

    #[test]
    fn test_delta_no_mutations() {
        let mut engine = DeltaEngine::new();
        let content = "[e1] button 'Save'";
        engine.process_snapshot(1, content);
        let res = engine.process_snapshot(1, content);
        assert_eq!(res["added_count"], 0);
        assert_eq!(res["removed_count"], 0);
        assert_eq!(res["diff"], "No mutations detected.");
    }
}
