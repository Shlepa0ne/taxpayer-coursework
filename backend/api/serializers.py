from rest_framework import serializers
from .models import Taxpayer, TaxAccrual, TaxReduceRequest, ReduceBase

class TaxpayerSerializer(serializers.ModelSerializer):
    class Meta:
        model = Taxpayer
        fields = ['taxpayer_id', 'full_name', 'short_name', 'inn']

class TaxAccrualSerializer(serializers.ModelSerializer):
    class Meta:
        model = TaxAccrual
        fields = ['tax_accrual_id', 'accrual_date', 'accrual_amount', 'due_date']

class TaxReduceRequestSerializer(serializers.ModelSerializer):
    class Meta:
        model = TaxReduceRequest
        fields = ['requested_reduce_amount', 'full_description', 'reduce_base']

class RiskScoreInputSerializer(serializers.Serializer):
    taxpayer_id = serializers.IntegerField(
        required=True,
        help_text="ID налогоплательщика для расчета RiskScore"
    )

class RiskScoreOutputSerializer(serializers.Serializer):
    risk_score = serializers.IntegerField(help_text="Рассчитанный RiskScore")

class ReduceBaseSerializer(serializers.ModelSerializer):
    class Meta:
        model = ReduceBase
        fields = ['reduce_base_id', 'reduce_base_name']