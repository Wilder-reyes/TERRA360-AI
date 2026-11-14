#!/usr/bin/env python3
"""Remove only NASA S3/R2 archive objects older than the operator retention."""
from app.services.verified_archive import prune_expired
if __name__=="__main__":
    import json
    print(json.dumps(prune_expired(keep_days=14),sort_keys=True))
