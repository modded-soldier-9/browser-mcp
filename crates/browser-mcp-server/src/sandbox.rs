use std::path::{Component, Path, PathBuf};

/// Normalizes path components lexically by resolving '.' and '..'
pub fn normalize_path(path: &Path) -> PathBuf {
    let mut components = Vec::new();
    for component in path.components() {
        match component {
            Component::CurDir => {}
            Component::ParentDir => {
                match components.last() {
                    Some(Component::Normal(_)) => {
                        components.pop();
                    }
                    Some(Component::RootDir) => {
                        // At root directory; cannot traverse above root in an absolute path
                    }
                    _ => {
                        components.push(component);
                    }
                }
            }
            c => components.push(c),
        }
    }
    components.into_iter().collect()
}

#[cfg(windows)]
pub fn strip_verbatim_prefix(path: &Path) -> PathBuf {
    use std::path::Prefix;
    let mut components = path.components();
    match components.next() {
        Some(Component::Prefix(prefix_component)) => {
            match prefix_component.kind() {
                Prefix::VerbatimDisk(disk) => {
                    let mut p = PathBuf::from(format!("{}:\\", disk as char));
                    for c in components {
                        if c == Component::RootDir {
                            continue;
                        }
                        p.push(c.as_os_str());
                    }
                    p
                }
                Prefix::VerbatimUNC(server, share) => {
                    let mut p = PathBuf::from(format!(r"\\{}\{}\", server.to_string_lossy(), share.to_string_lossy()));
                    for c in components {
                        if c == Component::RootDir {
                            continue;
                        }
                        p.push(c.as_os_str());
                    }
                    p
                }
                _ => path.to_path_buf(),
            }
        }
        _ => path.to_path_buf(),
    }
}

#[cfg(not(windows))]
pub fn strip_verbatim_prefix(path: &Path) -> PathBuf {
    path.to_path_buf()
}

pub fn path_starts_with(path: &Path, base: &Path) -> bool {
    #[cfg(not(windows))]
    {
        path.starts_with(base)
    }
    #[cfg(windows)]
    {
        if path.starts_with(base) {
            return true;
        }
        let path_comps: Vec<_> = path.components().collect();
        let base_comps: Vec<_> = base.components().collect();
        if path_comps.len() < base_comps.len() {
            return false;
        }
        for (p, b) in path_comps.iter().zip(base_comps.iter()) {
            match (p, b) {
                (Component::Prefix(p1), Component::Prefix(p2)) => {
                    if p1.as_os_str().to_string_lossy().to_lowercase() != p2.as_os_str().to_string_lossy().to_lowercase() {
                        return false;
                    }
                }
                (Component::Normal(p1), Component::Normal(b1)) => {
                    if p1.to_string_lossy().to_lowercase() != b1.to_string_lossy().to_lowercase() {
                        return false;
                    }
                }
                (p1, b1) => {
                    if p1 != b1 {
                        return false;
                    }
                }
            }
        }
        true
    }
}

pub fn resolve_screenshot_path(input_path: &str, cwd: &Path) -> Result<PathBuf, String> {
    if input_path.trim().is_empty() {
        return Err("Screenshot path cannot be empty".to_string());
    }

    let canonical_cwd = cwd.canonicalize().unwrap_or_else(|_| cwd.to_path_buf());
    let clean_cwd = strip_verbatim_prefix(&canonical_cwd);
    let clean_raw_cwd = strip_verbatim_prefix(cwd);

    let raw_target = if Path::new(input_path).is_absolute() {
        PathBuf::from(input_path)
    } else {
        clean_cwd.join(input_path)
    };

    let normalized = normalize_path(&raw_target);
    let clean_normalized = strip_verbatim_prefix(&normalized);

    if clean_normalized == clean_cwd || clean_normalized == clean_raw_cwd {
        return Err(format!(
            "Path must point to a file inside the working directory, not the directory itself ({}).",
            clean_cwd.display()
        ));
    }

    if !path_starts_with(&clean_normalized, &clean_cwd) && !path_starts_with(&clean_normalized, &clean_raw_cwd) {
        return Err(format!(
            "Path must be inside the working directory ({}). \"{}\" points outside.",
            clean_cwd.display(),
            input_path
        ));
    }

    // Check deepest existing ancestor directory (symlink resolution)
    let mut ancestor = clean_normalized.parent();
    while let Some(a) = ancestor {
        if a.exists() {
            let canonical_ancestor = a.canonicalize().map_err(|e| e.to_string())?;
            let clean_ancestor = strip_verbatim_prefix(&canonical_ancestor);
            if !path_starts_with(&clean_ancestor, &clean_cwd) && !path_starts_with(&clean_ancestor, &clean_raw_cwd) {
                return Err(format!(
                    "Path must be inside the working directory ({}). \"{}\" points outside.",
                    clean_cwd.display(),
                    input_path
                ));
            }
            break;
        }
        ancestor = a.parent();
    }

    Ok(clean_normalized)
}

pub fn sanitize_upload_files(files: &[String], cwd: &Path) -> Result<Vec<String>, String> {
    let canonical_cwd = cwd.canonicalize().unwrap_or_else(|_| cwd.to_path_buf());
    let mut clean_files = Vec::new();

    for f in files {
        let path = PathBuf::from(f);
        let target = if path.is_absolute() {
            path
        } else {
            cwd.join(path)
        };

        let canonical_target = target.canonicalize().map_err(|_| {
            format!("The file must be inside the working directory ({}). \"{}\" does not exist (or cannot be read).", canonical_cwd.display(), f)
        })?;

        if !canonical_target.starts_with(&canonical_cwd) {
            return Err(format!(
                "The file must be inside the working directory ({}). \"{}\" points outside.",
                canonical_cwd.display(),
                f
            ));
        }

        if !canonical_target.is_file() {
            return Err(format!(
                "The file must be inside the working directory ({}). \"{}\" is not a regular file.",
                canonical_cwd.display(),
                f
            ));
        }

        clean_files.push(canonical_target.to_string_lossy().to_string());
    }

    Ok(clean_files)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_normalize_path() {
        assert_eq!(normalize_path(Path::new("a/b/../c")), PathBuf::from("a/c"));
        assert_eq!(normalize_path(Path::new("./a/./b/./c")), PathBuf::from("a/b/c"));
        assert_eq!(normalize_path(Path::new("a/b/../../c")), PathBuf::from("c"));
        assert_eq!(normalize_path(Path::new("a/b/../../../c")), PathBuf::from("../c"));
    }

    #[test]
    fn test_resolve_screenshot_path_valid_relative() {
        let cwd = std::env::current_dir().unwrap();
        let canonical_cwd = cwd.canonicalize().unwrap_or_else(|_| cwd.clone());
        let res = resolve_screenshot_path("screenshot.png", &cwd);
        assert!(res.is_ok());
        let path = res.unwrap();
        assert!(path.ends_with("screenshot.png"));
        assert!(path_starts_with(&path, &strip_verbatim_prefix(&canonical_cwd)));
    }

    #[test]
    fn test_resolve_screenshot_path_nonexistent_traversal() {
        let cwd = std::env::current_dir().unwrap();
        let res = resolve_screenshot_path("nonexistent_dir_123/../../outside.png", &cwd);
        assert!(res.is_err());
        let err = res.unwrap_err();
        assert!(err.contains("points outside"));
    }

    #[test]
    fn test_resolve_screenshot_path_traversal_relative() {
        let cwd = std::env::current_dir().unwrap();
        let res = resolve_screenshot_path("../../outside.png", &cwd);
        assert!(res.is_err());
        let err = res.unwrap_err();
        assert!(err.contains("points outside"));
    }

    #[test]
    fn test_resolve_screenshot_path_empty_or_cwd() {
        let cwd = std::env::current_dir().unwrap();
        assert!(resolve_screenshot_path("", &cwd).is_err());
        assert!(resolve_screenshot_path("   ", &cwd).is_err());
        assert!(resolve_screenshot_path(".", &cwd).is_err());
    }

    #[test]
    fn test_resolve_screenshot_path_valid_subdirs() {
        let cwd = std::env::current_dir().unwrap();
        let res = resolve_screenshot_path("deep/nested/dir/shot.png", &cwd);
        assert!(res.is_ok());
        let path = res.unwrap();
        assert!(path.ends_with(Path::new("deep").join("nested").join("dir").join("shot.png")));
    }
}
