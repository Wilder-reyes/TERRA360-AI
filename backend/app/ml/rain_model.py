"""Reproducible experimental *regional monthly rainfall* ML pipeline.

Purpose: test whether a learned, lagged-rain linear model beats seasonal
climatology in out-of-time holdouts. No training data or claimed skill ships
in source distribution. The forecast is deliberately NOT an agronomic decision
input until independently validated; it cannot predict plot irrigation.
"""
from __future__ import annotations
import calendar
import json
import math
from datetime import date
from pathlib import Path
from statistics import median, mean
from typing import Any
import numpy as np

MODEL_VERSION = 'ridge_monthly_precipitation_0.1'
MIN_TRAIN_MONTHS = 84
HOLDOUT_MONTHS = 24


def valid_months(records: list[dict]) -> list[dict]:
    by_month = {}
    for row in records:
        try:
            d = date.fromisoformat(str(row['date']))
            rain = row['PRECTOTCORR']
            temp = row['T2M']
            if rain is None or temp is None or not math.isfinite(float(rain)) or not math.isfinite(float(temp)) or float(rain) < 0:
                continue
            by_month.setdefault((d.year,d.month),{})[d.day]=(float(rain),float(temp))
        except (KeyError, ValueError, TypeError, OverflowError):
            continue
    complete=[]
    for (year,month),days in sorted(by_month.items()):
        if len(days) == calendar.monthrange(year,month)[1]:
            complete.append({'year':year,'month':month, 'ordinal':year*12+month,
                             'rain_total_mm':sum(r for r,_ in days.values()),
                             'temperature_mean_c':mean(t for _,t in days.values())})
    return complete


def build_matrix(months: list[dict]) -> tuple[np.ndarray,np.ndarray,list[dict]]:
    """Predict month t using only months t-1..t-3 and seasonal position t."""
    rows = sorted(months,key=lambda x:x['ordinal'])
    feats=[]; targets=[]; meta=[]
    for i in range(3,len(rows)):
        seq = rows[i-3:i+1]
        if any(b['ordinal']-a['ordinal'] != 1 for a,b in zip(seq,seq[1:])):
            continue
        now=rows[i]; older=rows[i-3:i]
        features=[math.sin(2*math.pi*now['month']/12),math.cos(2*math.pi*now['month']/12),
                  *[math.log1p(r['rain_total_mm']) for r in reversed(older)],
                  older[-1]['temperature_mean_c']]
        feats.append(features);targets.append(math.log1p(now['rain_total_mm']));meta.append(now)
    return np.asarray(feats,dtype=float),np.asarray(targets,dtype=float),meta


def fit_ridge(X:np.ndarray,y:np.ndarray,alpha:float=10.0)->dict:
    scale=np.std(X,axis=0);scale=np.where(scale<1e-8,1.0,scale)
    center=X.mean(axis=0);Z=(X-center)/scale
    Z=np.column_stack((np.ones(len(Z)),Z))
    penalty=np.eye(Z.shape[1]);penalty[0,0]=0.0
    coeff=np.linalg.solve(Z.T@Z+alpha*penalty,Z.T@y)
    return {'center':center.tolist(),'scale':scale.tolist(),'coefficients':coeff.tolist(),'alpha':alpha}


def predict_ridge(model:dict,X:np.ndarray)->np.ndarray:
    center=np.asarray(model['center']);scale=np.asarray(model['scale']);coef=np.asarray(model['coefficients'])
    Z=(X-center)/scale
    log_pred=np.column_stack((np.ones(len(Z)),Z))@coef
    return np.maximum(0,np.expm1(np.clip(log_pred,0,15)))


def report_skill(months: list[dict]) -> dict:
    X,y,meta=build_matrix(months)
    if len(y)<MIN_TRAIN_MONTHS+2*HOLDOUT_MONTHS:
        return {'status':'not_evaluable','reason':'Insufficient complete consecutive months for two chronological holdouts.',
                'valid_training_examples':len(y),'min_required':MIN_TRAIN_MONTHS+2*HOLDOUT_MONTHS,
                'model_version':MODEL_VERSION}
    folds=[]
    for stop in [len(y)-HOLDOUT_MONTHS,len(y)]:
        begin=stop-HOLDOUT_MONTHS
        trainX,trainY=X[:begin],y[:begin]
        testX,testMeta=X[begin:stop],meta[begin:stop]
        if len(trainY)<MIN_TRAIN_MONTHS:
            return {'status':'not_evaluable','reason':'Short training window','valid_training_examples':len(y)}
        model=fit_ridge(trainX,trainY)
        machine=predict_ridge(model,testX)
        climatology={m:median([math.expm1(trainY[j]) for j,z in enumerate(meta[:begin]) if z['month']==m])
                     for m in range(1,13)}
        baseline=np.asarray([climatology[z['month']] for z in testMeta])
        truth=np.expm1(y[begin:stop])
        mae_ml=float(np.abs(truth-machine).mean());mae_ref=float(np.abs(truth-baseline).mean())
        improvement=(mae_ref-mae_ml)/mae_ref if mae_ref>1e-8 else 0.0
        folds.append({'test_from':f"{testMeta[0]['year']}-{testMeta[0]['month']:02d}",
                      'test_to':f"{testMeta[-1]['year']}-{testMeta[-1]['month']:02d}",
                      'n':len(truth), 'mae_model_mm':round(mae_ml,3),
                      'mae_seasonal_reference_mm':round(mae_ref,3),
                      'relative_mae_improvement':round(improvement,4)})
    # Conservative deployment: both holdout periods must improve by >=5%.
    accepted=all(f['relative_mae_improvement']>=0.05 for f in folds)
    return {'status':'accepted_for_experimental_display' if accepted else 'withheld_did_not_beat_reference',
            'model_version':MODEL_VERSION,'target':'next_month_regional_precipitation_total_mm',
            'feature_source':'NASA POWER daily precipitation, temperature and seasonal position',
            'valid_training_examples':len(y),'folds':folds,
            'minimum_improvement_per_holdout':0.05,'is_field_forecast':False,
            'independent_plot_validation':False,
            'trained_model':fit_ridge(X,y) if accepted else None}


def export_report(months:list[dict],location:dict,path:Path)->dict:
    report=report_skill(months)
    report['location']=location
    report['source']='NASA POWER'
    report['limitations']=['Predicts regional rainfall, not yields or irrigation needs.',
                           'Temporal holdouts do not establish transfer to another region.',
                           'Rainfall estimates require independent local validation.']
    # No prediction is exposed by API yet, even if a local fit passes two folds.
    path.parent.mkdir(parents=True,exist_ok=True)
    path.write_text(json.dumps(report,ensure_ascii=False,indent=2),encoding='utf-8')
    return {k:v for k,v in report.items() if k!='trained_model'}
