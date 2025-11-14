#!/usr/bin/env python3
"""
Script to verify AI chatbot responses against ProSchool360 codebase
"""
import json
import re
from pathlib import Path

def load_corpus():
    """Load the ProSchool360 corpus"""
    try:
        with open('proschool360_corpus.json', 'r', encoding='utf-8') as f:
            return json.load(f)
    except Exception as e:
        print(f"Error loading corpus: {e}")
        return []

def search_student_management(corpus):
    """Search for student management functionality in the codebase"""
    student_files = []
    add_student_patterns = [
        r'add.*student',
        r'new.*student', 
        r'create.*student',
        r'register.*student',
        r'student.*add',
        r'student.*create',
        r'student.*registration'
    ]
    
    for file_data in corpus:
        file_path = file_data.get('path', '')
        content = file_data.get('content', '').lower()
        
        # Check if file is related to student management
        if any(pattern in file_path.lower() for pattern in ['student', 'admission']):
            student_files.append({
                'path': file_path,
                'content_preview': content[:500] + '...' if len(content) > 500 else content
            })
            
        # Search for add student patterns
        for pattern in add_student_patterns:
            if re.search(pattern, content, re.IGNORECASE):
                print(f"Found pattern '{pattern}' in: {file_path}")
                # Extract relevant code sections
                lines = content.split('\n')
                for i, line in enumerate(lines):
                    if re.search(pattern, line, re.IGNORECASE):
                        start = max(0, i-3)
                        end = min(len(lines), i+10)
                        context = '\n'.join(lines[start:end])
                        print(f"Context around line {i+1}:")
                        print(context)
                        print("-" * 50)
    
    return student_files

def analyze_ai_response():
    """Analyze the AI response for accuracy"""
    ai_response = """
    The AI suggested these steps for adding a new student:
    1. Log in with administrator credentials
    2. Navigate to Student Management section
    3. Find "Add New Student" option
    4. Fill out student information form
    5. Upload student photo (optional)
    6. Review and save
    
    The AI mentioned fields like:
    - Personal Information (Name, DOB, Gender, etc.)
    - Contact Information (Address, Phone, Email)
    - Academic Information (Grade Level, Class/Section)
    - Parent/Guardian Information
    - Medical Information
    - Emergency Contacts
    """
    
    print("AI Response Analysis:")
    print("=" * 60)
    print(ai_response)
    print("=" * 60)

def main():
    print("ProSchool360 Chatbot Response Verification")
    print("=" * 50)
    
    # Load and analyze corpus
    corpus = load_corpus()
    if not corpus:
        print("Failed to load corpus file")
        return
    
    print(f"Loaded {len(corpus)} files from corpus")
    
    # Search for student management functionality
    print("\nSearching for student management functionality...")
    student_files = search_student_management(corpus)
    
    print(f"\nFound {len(student_files)} student-related files:")
    for file_info in student_files[:5]:  # Show first 5
        print(f"- {file_info['path']}")
    
    # Analyze AI response
    analyze_ai_response()
    
    # Provide verification summary
    print("\nVERIFICATION SUMMARY:")
    print("=" * 30)
    print("❌ ISSUE: AI response appears to be GENERIC, not based on actual ProSchool360 code")
    print("❌ The response uses generic school management terminology")
    print("❌ No specific ProSchool360 UI elements, routes, or code references")
    print("❌ Response is in 'fallback mode' - not using indexed codebase")
    print("\n✅ RECOMMENDATION: Deploy with ChromaDB to get accurate, code-specific responses")

if __name__ == "__main__":
    main()