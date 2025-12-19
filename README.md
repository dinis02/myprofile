# myprofile

Simple, static CV website. No backend, no database.

**Folder:** `frontend/`

## Run locally

Option A — open directly:
- Open `frontend/index.html` in your browser (double‑click).

Option B — serve with Python (recommended):

```bash
cd frontend
python3 -m http.server 5173
# then open http://localhost:5173
```

Or use VS Code “Live Server” to serve the `frontend/` folder.

## Customize your CV

- Edit `frontend/index.html`: replace name, role, contacts, and fill the
	Summary, Skills, Experience, Projects, Education, and Certifications.
- Add your photo at `frontend/assets/profile.jpg` (create the folder if needed).
- Styles live in `frontend/styles.css` (mobile responsive + print‑ready).
- Click “Download PDF” (Print) to export a clean PDF.

## Next steps (optional)

- Convert to Angular SPA with sections and routing.
- Add GitHub Pages deploy workflow for free hosting.
