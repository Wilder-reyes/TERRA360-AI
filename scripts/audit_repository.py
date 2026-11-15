"""Local architecture/security audit. Reports locations, never credential values."""
import ast
import json
import re
import subprocess
from pathlib import Path

ROOT=Path(__file__).resolve().parents[1]
PATTERNS={
    'private_key':re.compile(r'-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----'),
    'github_token':re.compile(r'\b(?:gh[pousr]_[A-Za-z0-9]{30,}|github_pat_[A-Za-z0-9_]{50,})\b'),
    'aws_access_key':re.compile(r'\b(?:AKIA|ASIA)[A-Z0-9]{16}\b'),
    'jwt_literal':re.compile(r'\beyJ[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}\b'),
    'frontend_secret_name':re.compile(r'VITE_[A-Z_]*(?:TOKEN|SECRET|PASSWORD|PRIVATE_KEY|ACCESS_KEY)[A-Z_]*\s*='),
}

def audit():
    raw=subprocess.check_output(['git','ls-files','-z','--cached','--others','--exclude-standard'],cwd=ROOT)
    paths=sorted(set(raw.decode().split('\0'))-{''})
    findings=[]
    broken=[]
    syntax=[]
    for name in paths:
        p=ROOT/name
        if not p.is_file():continue # staged deletions still appear until commit
        try:text=p.read_text(encoding='utf-8-sig')
        except (UnicodeDecodeError,OSError):continue
        for line,row in enumerate(text.splitlines(),1):
            for kind,pattern in PATTERNS.items():
                if pattern.search(row):findings.append({'file':name,'line':line,'kind':kind})
        if p.suffix=='.py':
            try:ast.parse(text)
            except SyntaxError as exc:syntax.append({'file':name,'line':exc.lineno})
        if name.startswith('frontend/src/') and p.suffix in ('.ts','.tsx'):
            for target in re.findall(r'''(?:from\s*|import\s*\(?\s*)['"](\.[^'"]+)['"]''',text):
                base=p.parent/target
                if not any(q.is_file() for q in [base,Path(str(base)+'.ts'),Path(str(base)+'.tsx'),base/'index.ts']):
                    broken.append({'file':name,'import':target})
    return {'files_considered':len(paths),'credential_candidates':findings,
            'broken_relative_frontend_imports':broken,'python_syntax_errors':syntax,
            'limits':'Static patterns only; not a credential revocation, account/integration review or guarantee that no secret exists in Git history. Ignored local caches/environments are excluded.'}

if __name__=='__main__':
    result=audit()
    print(json.dumps(result,indent=2))
    raise SystemExit(bool(result['credential_candidates'] or result['broken_relative_frontend_imports'] or result['python_syntax_errors']))
