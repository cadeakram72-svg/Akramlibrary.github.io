"""Run against the actual GitHub Pages publish directory, not the backend package."""
from pathlib import Path
import sys
root=Path(sys.argv[1] if len(sys.argv)>1 else '.')
forbidden={'assets--books--dhis-naftaada.pdf','assets--books--ganacsade.pdf'}
bad=[str(p) for p in root.rglob('*') if p.is_file() and (p.name in forbidden or p.name=='.env' or p.name=='secrets.env')]
if bad:
 print('BLOCKED: private books or secrets found in public directory:\n'+'\n'.join(bad));sys.exit(1)
print('PASS known paid PDFs and server environment files absent. Also review new paid books and Git history.')
