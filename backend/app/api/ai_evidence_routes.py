"""Public audit evidence only; this endpoint never infers for arbitrary parcels."""
from fastapi import APIRouter, HTTPException
from app.services.field_shift_ai import evaluated_holdout

router = APIRouter(prefix='/api/ai', tags=['AI evidence'])

@router.get('/validated-models')
def validated_models():
    try:
        return {
            'status': 'scoped_evidence_only',
            'models': [evaluated_holdout()],
            'chalhuas': {
                'status': 'not_trained_or_spatially_validated',
                'metrics': None,
                'reason': 'La evidencia validada es de una parcela de Barranca; no se extrapola a Junín.'
            },
        }
    except (OSError, ValueError, KeyError, TypeError):
        raise HTTPException(503, 'No se pudo reproducir la evidencia científica del modelo.')
