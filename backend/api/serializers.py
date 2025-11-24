from rest_framework import serializers
from django.db.models import Sum
from django.utils import timezone
from .models import Taxpayer, TaxAccrual, TaxReduceRequest, ReduceBase, TaxableObject, ObjectOwnership, TaxPayment, TaxType, Declaration, TaxPeriod

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
    verdict_date = serializers.DateTimeField(read_only=True)
    
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

class TaxAccrualWithPaymentSerializer(serializers.ModelSerializer):
    paid_amount = serializers.SerializerMethodField()
    remaining_amount = serializers.SerializerMethodField()
    is_overdue = serializers.SerializerMethodField()
    income_status_name = serializers.SerializerMethodField()
    accrual_reason = serializers.SerializerMethodField()
    object_name = serializers.CharField(source='object.object_name', read_only=True, allow_null=True)
    object_address = serializers.CharField(source='object.object_address', read_only=True, allow_null=True)
    tax_type_name = serializers.SerializerMethodField()
    declaration_info = serializers.SerializerMethodField()
    is_6ndfl_accrual = serializers.SerializerMethodField()
    declarant_info = serializers.SerializerMethodField()
    
    class Meta:
        model = TaxAccrual
        fields = [
            'tax_accrual_id', 'accrual_date', 'accrual_amount', 
            'due_date', 'paid_amount', 'remaining_amount', 'is_overdue',
            'income_status_id', 'income_status_name', 'accrual_reason',
            'object_name', 'object_address', 'tax_type_name', 'declaration',
            'declaration_info', 'is_6ndfl_accrual', 'declarant_info'
        ]
    
    def get_paid_amount(self, obj):
        payments = TaxPayment.objects.filter(tax_income=obj)
        total_paid = payments.aggregate(total=Sum('payment_amount'))['total']
        return total_paid if total_paid else 0
    
    def get_remaining_amount(self, obj):
        paid = self.get_paid_amount(obj)
        return obj.accrual_amount - paid
    
    def get_is_overdue(self, obj):
        if obj.due_date:
            return timezone.now().date() > obj.due_date
        return False
    
    def get_income_status_name(self, obj):
        status_map = {
            1: "начислено",
            2: "частично оплачено", 
            3: "оплачено",
            4: "просрочено"
        }
        return status_map.get(obj.income_status_id, "неизвестно")
    
    def get_tax_type_name(self, obj):
        tax_type_map = {
            13: "Налог на доходы физических лиц (НДФЛ)",
            14: "Транспортный налог",
            15: "Налог на имущество", 
            16: "Налог на добавочную стоимость (НДС)"
        }
        return tax_type_map.get(obj.tax_type_id, f"Неизвестный налог (ID: {obj.tax_type_id})")
    
    def get_accrual_reason(self, obj):
        if obj.object:
            object_type = "неизвестный объект"
            if obj.object.object_type:
                object_type = obj.object.object_type.object_type_name.lower()
            return f"Налог на {object_type}"
        elif obj.declaration:
            declaration_info = self.get_declaration_info(obj)
            if declaration_info and declaration_info.get('is_6ndfl'):
                if declaration_info.get('is_declarant'):
                    return f"НДФЛ за сотрудника {declaration_info.get('target_name', '')}"
                else:
                    return f"НДФЛ от работодателя {declaration_info.get('declarant_name', '')}"
            return f"Налог по декларации #{obj.declaration.declaration_id}"
        else:
            return f"{self.get_tax_type_name(obj)}"
    
    def get_declaration_info(self, obj):
        """Получает информацию о декларации для начисления"""
        if not obj.declaration:
            return None
        
        try:
            declaration = obj.declaration
            
            # Определяем, является ли это 6-НДФЛ
            is_6ndfl = declaration.who_declares_id != declaration.taxpayer_id
            
            # Определяем, является ли текущий пользователь тем, кто подал декларацию
            current_taxpayer = None
            request = self.context.get('request')
            if request and hasattr(request, 'user'):
                user_inn = request.user.username
                try:
                    current_taxpayer = Taxpayer.objects.get(inn=user_inn)
                except Taxpayer.DoesNotExist:
                    pass
            
            is_declarant = current_taxpayer and declaration.who_declares_id == current_taxpayer.taxpayer_id
            
            info = {
                'is_6ndfl': is_6ndfl,
                'is_declarant': is_declarant,
                'declaration_type': '6-НДФЛ' if is_6ndfl else '3-НДФЛ'
            }
            
            if is_6ndfl:
                # Для 6-НДФЛ добавляем информацию о том, кто подал и за кого
                info.update({
                    'declarant_name': self._get_taxpayer_display_name(declaration.who_declares),
                    'target_name': self._get_taxpayer_display_name(declaration.taxpayer),
                    'declarant_inn': declaration.who_declares.inn,
                    'target_inn': declaration.taxpayer.inn
                })
            
            return info
            
        except Exception as e:
            print(f"Error getting declaration info: {e}")
            return None
    
    def get_is_6ndfl_accrual(self, obj):
        declaration_info = self.get_declaration_info(obj)
        return declaration_info and declaration_info.get('is_6ndfl', False)
    
    def get_declarant_info(self, obj):
        declaration_info = self.get_declaration_info(obj)
        if declaration_info and declaration_info.get('is_6ndfl'):
            return {
                'declarant_name': declaration_info.get('declarant_name'),
                'target_name': declaration_info.get('target_name'),
                'is_declarant': declaration_info.get('is_declarant')
            }
        return None
    
    def _get_taxpayer_display_name(self, taxpayer):
        """Форматирует имя налогоплательщика для отображения"""
        if taxpayer.fio:
            return taxpayer.fio
        elif taxpayer.full_name:
            return taxpayer.full_name
        elif taxpayer.short_name:
            return taxpayer.short_name
        else:
            return f"ИНН {taxpayer.inn}"

class TaxPaymentSerializer(serializers.ModelSerializer):
    class Meta:
        model = TaxPayment
        fields = ['payment_id', 'payment_date', 'payment_amount', 'tax_income_id']
        read_only_fields = ['payment_id', 'payment_date']

class PaymentCreateSerializer(serializers.Serializer):
    tax_accrual_id = serializers.IntegerField(required=True)
    payment_amount = serializers.DecimalField(max_digits=20, decimal_places=2, required=True)
    payment_method = serializers.ChoiceField(
        choices=[('card', 'Банковская карта'), ('SPB', 'Система быстрых платежей (СБП)')],
        default='card'
    )

class DeclarationSerializer(serializers.ModelSerializer):
    tax_type_name = serializers.CharField(source='tax_type.tax_type_name', read_only=True)
    declaration_status_name = serializers.CharField(source='get_declaration_status_display', read_only=True)
    period_name = serializers.SerializerMethodField()
    
    tax_amount = serializers.DecimalField(
        source='tax_sum', 
        max_digits=20, 
        decimal_places=2, 
        write_only=True,
        required=True
    )
    tax_type_id = serializers.PrimaryKeyRelatedField(
        queryset=TaxType.objects.all(),
        source='tax_type',
        write_only=True,
        required=True
    )
    period_start = serializers.DateField(write_only=True, required=True)
    period_end = serializers.DateField(write_only=True, required=True)
    declaration_type = serializers.CharField(write_only=True, required=True)
    target_inn = serializers.CharField(write_only=True, required=False, allow_blank=True)
    
    class Meta:
        model = Declaration
        fields = [
            'declaration_id', 
            'submission_date', 
            'tax_type', 
            'tax_type_name', 
            'tax_type_id',
            'tax_amount',
            'tax_sum',
            'total_income', 
            'period',
            'period_name',
            'period_start',
            'period_end',
            'declaration_status_id',
            'declaration_status_name',
            'declaration_type',
            'target_inn'
        ]
        read_only_fields = [
            'declaration_id', 'submission_date', 'declaration_status_id', 
            'tax_sum', 'tax_type', 'period'
        ]
    
    def get_period_name(self, obj):
        if obj.period:
            return obj.period.period_name
        return "—"
    
class DeclarationListSerializer(serializers.ModelSerializer):
    tax_type_name = serializers.CharField(source='tax_type.tax_type_name', read_only=True)
    tax_amount = serializers.DecimalField(source='tax_sum', max_digits=20, decimal_places=2, read_only=True)
    declaration_type = serializers.SerializerMethodField()
    target_taxpayer_name = serializers.SerializerMethodField()
    period_name = serializers.SerializerMethodField()
    period_start = serializers.DateField(source='period.start_date', read_only=True)
    period_end = serializers.DateField(source='period.end_date', read_only=True)
    
    class Meta:
        model = Declaration
        fields = [
            'declaration_id', 
            'submission_date', 
            'tax_type_name', 
            'tax_amount',
            'total_income', 
            'declaration_type',
            'target_taxpayer_name',
            'period_name',
            'period_start', 
            'period_end',
            'declaration_status_id'
        ]
    
    def get_declaration_type(self, obj):
        if obj.who_declares_id == obj.taxpayer_id:
            return '3-НДФЛ'
        else:
            return '6-НДФЛ'
    
    def get_target_taxpayer_name(self, obj):
        if obj.who_declares_id == obj.taxpayer_id:
            return "За себя"
        else:
            taxpayer = obj.taxpayer
            if taxpayer.fio:
                return f"{taxpayer.fio} (ИНН: {taxpayer.inn})"
            elif taxpayer.full_name:
                return f"{taxpayer.full_name} (ИНН: {taxpayer.inn})"
            else:
                return f"Налогоплательщик (ИНН: {taxpayer.inn})"
    
    def get_period_name(self, obj):
        if obj.period:
            return obj.period.period_name
        return "—"

class TaxTypeSerializer(serializers.ModelSerializer):
    class Meta:
        model = TaxType
        fields = ['tax_type_id', 'tax_type_name'] 

class TaxPeriodSerializer(serializers.ModelSerializer):
    period_name = serializers.SerializerMethodField()
    
    class Meta:
        model = TaxPeriod
        fields = ['period_id', 'start_date', 'end_date', 'period_type_id', 'period_name']
    
    def get_period_name(self, obj):
        return obj.period_name