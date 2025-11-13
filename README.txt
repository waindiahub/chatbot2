
HOW TO USE:

1. Upload to Railway as a new project.
2. Put your proschool360_corpus.json in the project root.
3. Run locally first:
   pip install -r requirements.txt
   python build_chroma.py
4. Push to GitHub → Deploy on Railway.
5. Add env variable GEMINI_API_KEY in Railway.
6. Python API URL will be: https://your-app.up.railway.app/ask?question=Hello
