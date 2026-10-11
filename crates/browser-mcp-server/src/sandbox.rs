use std::path::{Path, PathBuf};

pub fn resolve_screenshot_path(input_path: &str, cwd: &Path) -> Result<PathBuf, String> {
    let raw_target = if Path::new(input_path).is_absolute() {
        PathBuf::from(input_path)
    } else {
        cwd.join(input_path)
    };

    // Canonicalize or normalize to prevent directory traversal
    let canonical_cwd = cwd.canonicalize().unwrap_or_else(|_| cwd.to_path_buf());
    
    // Check parent path exists or is within cwd
    if let Some(parent) = raw_target.parent() {
        if parent.exists() {
            let canonical_parent = parent.canonicalize().map_err(|e| e.to_string())?;
            if !canonical_parent.starts_with(&canonical_cwd) {
                return Err(format!(
                    "Path must be inside the working directory ({}). \"{}\" points outside.",
                    canonical_cwd.display(),
                    input_path
                ));
            }
        }
    }

    Ok(raw_target)
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
