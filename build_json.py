#!/usr/bin/env python3
import os
import json
from pathlib import Path

def should_exclude(path, scan_root):
    """Check if file/folder should be excluded"""
    relative_path = os.path.relpath(path, scan_root)
    
    # Exclude third_party folder
    if 'third_party' in relative_path:
        return True
    
    # Exclude file extensions
    if path.endswith(('.sql', '.md')):
        return True
    
    return False

def scan_project(scan_root):
    """Scan application folder and collect file contents"""
    corpus = []
    
    for root, dirs, files in os.walk(scan_root):
        # Filter out excluded directories
        dirs[:] = [d for d in dirs if not should_exclude(os.path.join(root, d), scan_root)]
        
        for file in files:
            file_path = os.path.join(root, file)
            
            if should_exclude(file_path, scan_root):
                continue
            
            try:
                with open(file_path, 'r', encoding='utf-8', errors='ignore') as f:
                    content = f.read()
                
                relative_path = os.path.relpath(file_path, scan_root)
                corpus.append({
                    "path": relative_path.replace('\\', '/'),
                    "content": content
                })
                print(f"Added: {relative_path}")
                
            except Exception as e:
                print(f"Error reading {file_path}: {e}")
    
    return corpus

def main():
    # Get the parent directory of the chatbot folder (project root)
    script_dir = os.path.dirname(os.path.abspath(__file__))
    project_root = os.path.dirname(script_dir)
    
    # Look for application folder - adjust this path as needed
    app_folders = ['app', 'application', 'src', 'Application']
    target_folder = None
    
    for folder in app_folders:
        potential_path = os.path.join(project_root, folder)
        if os.path.exists(potential_path):
            target_folder = potential_path
            break
    
    if not target_folder:
        print("No application folder found. Looking for folders:")
        for folder in os.listdir(project_root):
            if os.path.isdir(os.path.join(project_root, folder)):
                print(f"  - {folder}")
        return
    
    output_file = os.path.join(script_dir, "proschool360_corpus.json")
    
    print(f"Scanning application folder: {target_folder}")
    corpus = scan_project(target_folder)
    
    print(f"Writing {len(corpus)} files to {output_file}")
    with open(output_file, 'w', encoding='utf-8') as f:
        json.dump(corpus, f, indent=2, ensure_ascii=False)
    
    print("Done!")

if __name__ == "__main__":
    main()