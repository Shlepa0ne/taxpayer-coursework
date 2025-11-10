from rest_framework import serializers
from .models import Taxpayer

class TaxpayerSerializer(serializers.ModelSerializer):
    """
    Сериализатор для модели Налогоплательщика.
    Он будет преобразовывать данные модели в JSON и обратно.
    """
    class Meta:
        model = Taxpayer
        fields = '__all__'

class RiskScoreInputSerializer(serializers.Serializer):
    """
    Сериализатор для валидации входных данных: ID налогоплательщика.
    """
    taxpayer_id = serializers.IntegerField(
        required=True, 
        help_text="ID налогоплательщика для расчета RiskScore"
    )

class RiskScoreOutputSerializer(serializers.Serializer):
    """
    Сериализатор для представления выходных данных: рассчитанного RiskScore.
    """
    risk_score = serializers.IntegerField(help_text="Рассчитанный RiskScore")
