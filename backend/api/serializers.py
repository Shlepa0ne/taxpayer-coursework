from rest_framework import serializers
from .models import Taxpayer, TaxAccrual, TaxReduceRequest, ReduceBase, TaxableObject, ObjectOwnership

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
    
class TaxReduceRequestListSerializer(serializers.ModelSerializer):
    reduce_base_name = serializers.CharField(source='reduce_base.reduce_base_name', read_only=True)
    request_status_name = serializers.CharField(source='request_status.report_status_name', read_only=True)
    reduce_type_name = serializers.CharField(source='reduce_type.reduce_type_name', read_only=True)
    verdict_date = serializers.DateTimeField(read_only=True)  # Добавляем явно
    
    class Meta:
        model = TaxReduceRequest
        fields = [
            'request_id', 'send_date', 'requested_reduce_amount', 
            'full_description', 'reduce_base_name', 'request_status_name',
            'reduce_type_name', 'verdict_date'
        ]

class TaxableObjectSerializer(serializers.ModelSerializer):
    object_type_name = serializers.CharField(source='object_type.object_type_name', read_only=True)
    real_estate_type_name = serializers.CharField(source='real_estate_type.real_estate_type_name', read_only=True)
    ownership_start_date = serializers.DateField(read_only=True)
    ownership_end_date = serializers.DateField(read_only=True)

    class Meta:
        model = TaxableObject
        fields = [
            'object_id', 'object_name', 'cadastral_number', 'object_address',
            'cadastral_value', 'transport_vin', 'registration_plate',
            'transport_model', 'extra_value', 'engine_power',
            'object_type_name', 'real_estate_type_name',
            'ownership_start_date', 'ownership_end_date'
        ]

class ObjectOwnershipSerializer(serializers.ModelSerializer):
    object = TaxableObjectSerializer(read_only=True)
    
    class Meta:
        model = ObjectOwnership
        fields = ['ownership_id', 'ownership_start_date', 'ownership_end_date', 'object']