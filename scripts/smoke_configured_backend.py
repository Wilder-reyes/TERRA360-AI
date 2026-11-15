"""Explicit, manual GET-only smoke check. No provider or deployment defaults."""
import argparse
import json
from urllib.parse import urlsplit
from urllib.request import Request,urlopen

def origin(value):
    p=urlsplit(value)
    if (p.scheme not in ('http','https') or not p.hostname or p.username or p.password
            or p.path not in ('','/') or p.query or p.fragment):
        raise argparse.ArgumentTypeError('Use an HTTP(S) origin without credentials or path')
    return value.rstrip('/')

def main():
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--site',type=origin,required=True)
    parser.add_argument('--api',type=origin,required=True)
    args=parser.parse_args()
    for host,path in [(args.site,'/release.json'),(args.api,'/api/health')]:
        request=Request(host+path,headers={'Accept':'application/json','User-Agent':'BIOTEX-manual-contract/1'})
        with urlopen(request,timeout=20) as response:
            if response.status!=200:raise RuntimeError(f'{path}: HTTP {response.status}')
            payload=json.loads(response.read(500_000))
            if not isinstance(payload,dict):raise ValueError(f'{path}: expected JSON object')
            print(path,'HTTP 200 JSON')
    return 0

if __name__=='__main__':raise SystemExit(main())
