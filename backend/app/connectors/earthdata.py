
import os
from datetime import date
from pathlib import Path
from typing import Any

import earthaccess
from dotenv import load_dotenv


BACKEND_DIR = Path(__file__).resolve().parents[2]
DATA_DIR = BACKEND_DIR / "data" / "gpm"

COLLECTION = "GPM_3IMERGDL"
VERSION = "07"


class EarthdataError(RuntimeError):
    """Raised when NASA Earthdata authentication or download fails."""


def authenticate() -> None:
    """Authenticate using the Earthdata token stored in backend/.env."""

    load_dotenv(BACKEND_DIR / ".env")

    token = os.getenv("EARTHDATA_TOKEN")

    if not token:
        raise EarthdataError(
            "EARTHDATA_TOKEN was not found in the backend .env file"
        )

    os.environ["EARTHDATA_TOKEN"] = token

    try:
        auth = earthaccess.login(strategy="environment")
    except Exception as exc:
        raise EarthdataError(
            f"NASA Earthdata authentication failed: {exc}"
        ) from exc

    if not auth.authenticated:
        raise EarthdataError("NASA Earthdata authentication was not verified")


def find_granule(target_date: date) -> list[Any]:
    """Search for the IMERG Late daily granule for a specific date."""

    authenticate()

    date_text = target_date.isoformat()

    try:
        granules = earthaccess.search_data(
            short_name=COLLECTION,
            version=VERSION,
            temporal=(date_text, date_text),
            count=10,
        )
    except Exception as exc:
        raise EarthdataError(
            f"NASA Earthdata search failed: {exc}"
        ) from exc

    matching_granules = []

    for granule in granules:
        metadata = granule.get("umm", {})
        related_urls = metadata.get("RelatedUrls", [])

        filenames = [
            item.get("URL", "")
            for item in related_urls
            if item.get("Type") == "GET DATA"
        ]

        if any(
            f"3B-DAY-L.MS.MRG.3IMERG.{target_date:%Y%m%d}-" in url
            for url in filenames
        ):
            matching_granules.append(granule)

    return matching_granules


def download_daily_granule(target_date: date) -> Path:
    """Download the IMERG Late daily file if it is not already local."""

    DATA_DIR.mkdir(parents=True, exist_ok=True)

    date_text = target_date.strftime("%Y%m%d")
    pattern = f"3B-DAY-L.MS.MRG.3IMERG.{date_text}-*.nc4"

    existing_files = sorted(DATA_DIR.glob(pattern))

    if existing_files:
        return existing_files[0]

    granules = find_granule(target_date)

    if not granules:
        raise EarthdataError(
            f"No GPM IMERG Late granule found for {target_date.isoformat()}"
        )

    try:
        downloaded_files = earthaccess.download(
            granules,
            local_path=str(DATA_DIR),
        )
    except Exception as exc:
        raise EarthdataError(
            f"NASA GPM download failed: {exc}"
        ) from exc

    for downloaded in downloaded_files or []:
        downloaded_path = Path(downloaded)

        if downloaded_path.exists() and downloaded_path.suffix == ".nc4":
            if date_text in downloaded_path.name:
                return downloaded_path

    existing_files = sorted(DATA_DIR.glob(pattern))

    if existing_files:
        return existing_files[0]

    raise EarthdataError(
        f"Download completed but no IMERG file was found for {date_text}"
    )
