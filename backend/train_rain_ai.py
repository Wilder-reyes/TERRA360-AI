"""Optional live NASA training; run locally, never included as fabricated demo data.

cd backend
.venv\\Scripts\\python.exe train_rain_ai.py --latitude -13.32 --longitude -71.95 --years 15

The report is produced only after NASA POWER responds. Training does not
change ARIE field decisions or make a planting recommendation.
"""
import argparse
import asyncio
from datetime import date
from pathlib import Path
from app.connectors.nasa_power import fetch_daily_point, normalize_daily, NasaPowerError
from app.ml.rain_model import valid_months, export_report

async def gather(latitude:float,longitude:float,years:int):
    semaphore=asyncio.Semaphore(2)
    async def annual(y:int):
        async with semaphore:
            try:
                start=date(y,1,1);end=date(y,12,31)
                raw=await fetch_daily_point(latitude,longitude,start,end,timeout=75)
                return normalize_daily(raw,start,end)['records']
            except (NasaPowerError,ValueError) as e:
                print(f'Year {y}: unavailable ({type(e).__name__})')
                return []
    values=await asyncio.gather(*(annual(y) for y in range(date.today().year-years,date.today().year)))
    return [r for part in values for r in part]

if __name__=='__main__':
    parser=argparse.ArgumentParser()
    parser.add_argument('--latitude',type=float,required=True)
    parser.add_argument('--longitude',type=float,required=True)
    parser.add_argument('--years',type=int,default=15,choices=range(12,26))
    args=parser.parse_args()
    if not -90<=args.latitude<=90 or not -180<=args.longitude<=180:
        parser.error('Coordinates are out of range')
    rows=asyncio.run(gather(args.latitude,args.longitude,args.years))
    months=valid_months(rows)
    report=export_report(months,{'latitude':args.latitude,'longitude':args.longitude,
                                 'period_years':args.years},Path('models/experimental_rain_report.json'))
    print('AI experiment:',report['status'])
    print('Full report: models/experimental_rain_report.json')
    for fold in report.get('folds',[]):
        print(fold)
