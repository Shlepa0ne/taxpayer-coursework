from rest_framework import serializers
from .models import Taxpayer, TaxAccrual, TaxReduceRequest, ReduceBase

class TaxpayerSerializer(serializers.ModelSerializer):
    class Meta:
        model = Taxpayer
        fields = ['taxpayer_id', 'fio', 'full_name', 'short_name', 'inn', 'payer_type_id']

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

class LoginSerializer(serializers.Serializer):
    inn = serializers.CharField(max_length=32)
    password = serializers.CharField(write_only=True)


class ProfileSerializer(serializers.ModelSerializer):
    class Meta:
        model = Taxpayer
        fields = [
            'taxpayer_id', 'inn', 'fio', 'full_name', 'short_name', 
            'birth_date', 'registration_address', 'fact_address',
            'ogrn', 'registration_date', 'bank_detals', 'start_date',
            'end_date', 'executive_list', 'payer_type_id'
        ]

class ChangePasswordSerializer(serializers.Serializer):
    current_password = serializers.CharField(required=True, write_only=True)
    new_password = serializers.CharField(required=True, write_only=True, min_length=6)
    confirm_password = serializers.CharField(required=True, write_only=True)

    def validate(self, attrs):
        if attrs['new_password'] != attrs['confirm_password']:
            raise serializers.ValidationError("Новые пароли не совпадают")
        return attrs