from rest_framework import serializers
from django.db.models import Sum
from django.utils import timezone
from django.db import connection  # ДОБАВЛЕН ИМПОРТ
from .models import *

class TaxpayerSerializer(serializers.ModelSerializer):
    class Meta:
        model = Taxpayer
        fields = ['taxpayer_id', 'fio', 'full_name', 'short_name', 'inn', 'payer_type_id']

class TaxAccrualSerializer(serializers.ModelSerializer):
    class Meta:
        model = TaxAccrual
        fields = ['tax_accrual_id', 'accrual_date', 'accrual_amount', 'due_date']

class TaxReduceRequestSerializer(serializers.ModelSerializer):
    tax_types = serializers.ListField(
        child=serializers.IntegerField(),
        write_only=True,
        required=True
    )
    periods = serializers.ListField(
        child=serializers.DictField(child=serializers.CharField()),
        write_only=True,
        required=True
    )
    reduce_type = serializers.IntegerField(write_only=True, required=True)
    
    class Meta:
        model = TaxReduceRequest
        fields = [
            'requested_reduce_amount', 
            'full_description', 
            'reduce_base',
            'reduce_type',
            'tax_types',
            'periods'
        ]

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
    periods = serializers.SerializerMethodField()
    
    class Meta:
        model = TaxReduceRequest
        fields = [
            'request_id', 'send_date', 'requested_reduce_amount', 
            'full_description', 'reduce_base_name', 'request_status_name',
            'reduce_type_name', 'verdict_date', 'periods'
        ]

    def get_periods(self, obj):
        """Получает периоды, связанные с заявлением"""
        try:
            # Получаем периоды через связующую таблицу rax_period_tax_reduce_request
            with connection.cursor() as cursor:
                cursor.execute("""
                    SELECT tp.period_id, tp.start_date, tp.end_date, tp.period_type_id
                    FROM tax_period tp
                    INNER JOIN rax_period_tax_reduce_request rptrr ON tp.period_id = rptrr.period_id
                    WHERE rptrr.request_id = %s
                """, [obj.request_id])
                periods_data = cursor.fetchall()
            
            periods = []
            for row in periods_data:
                period = TaxPeriod(
                    period_id=row[0],
                    start_date=row[1],
                    end_date=row[2],
                    period_type_id=row[3]
                )
                periods.append({
                    'period_id': period.period_id,
                    'start_date': period.start_date,
                    'end_date': period.end_date,
                    'period_name': period.period_name
                })
            
            return periods
            
        except Exception as e:
            print(f"Error getting periods for request {obj.request_id}: {e}")
            return []

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
    # ДОБАВЛЕНО: поля для информации о налогоплательщике
    taxpayer_inn = serializers.CharField(source='taxpayer.inn', read_only=True)
    taxpayer_fio = serializers.CharField(source='taxpayer.fio', read_only=True)
    taxpayer_full_name = serializers.CharField(source='taxpayer.full_name', read_only=True)
    taxpayer_short_name = serializers.CharField(source='taxpayer.short_name', read_only=True)
    payer_type_id = serializers.IntegerField(source='taxpayer.payer_type_id', read_only=True)
    payer_type_name = serializers.SerializerMethodField()
    
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
            'declaration_status_id',
            # ДОБАВЛЕНО:
            'taxpayer_inn',
            'taxpayer_fio',
            'taxpayer_full_name', 
            'taxpayer_short_name',
            'payer_type_id',
            'payer_type_name'
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
    
    def get_payer_type_name(self, obj):
        """Получает название типа плательщика"""
        payer_types = {
            1: "Физ. лицо",
            2: "ИП", 
            3: "Юр. лицо"
        }
        return payer_types.get(obj.taxpayer.payer_type_id, "Неизвестно")

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
    

class TaxpayerSearchSerializer(serializers.ModelSerializer):
    region_name = serializers.SerializerMethodField()
    tax_regime_name = serializers.SerializerMethodField()
    payer_type_name = serializers.SerializerMethodField()
    risk_score = serializers.SerializerMethodField()
    
    class Meta:
        model = Taxpayer
        fields = [
            'taxpayer_id', 'inn', 'fio', 'full_name', 'short_name',
            'registration_address', 'fact_address', 'ogrn',
            'registration_date', 'payer_type_id', 'region_key',
            'tax_regime_id', 'region_name', 'tax_regime_name',
            'payer_type_name', 'risk_score'
        ]
    
    def get_region_name(self, obj):
        try:
            region = Region.objects.get(region_id=obj.region_key)
            return region.name
        except Region.DoesNotExist:
            return "Не указан"
    
    def get_tax_regime_name(self, obj):
        try:
            regime = TaxRegime.objects.get(regime_id=obj.tax_regime_id)
            return regime.name
        except TaxRegime.DoesNotExist:
            return "Не указан"
    
    def get_payer_type_name(self, obj):
        payer_types = {
            1: "Физическое лицо",
            2: "Индивидуальный предприниматель", 
            3: "Юридическое лицо"
        }
        return payer_types.get(obj.payer_type_id, "Неизвестно")
    
    def get_risk_score(self, obj):
        try:
            with connection.cursor() as cursor:
                cursor.execute("""
                    SELECT rating_value 
                    FROM taxpayer_rating 
                    WHERE taxpayer_id = %s 
                    ORDER BY rating_date DESC, rating_id DESC 
                    LIMIT 1
                """, [obj.taxpayer_id])
                result = cursor.fetchone()
                print(f"DEBUG - Risk score query for taxpayer {obj.taxpayer_id}: {result}")  # Отладочная информация
                if result and result[0] is not None:
                    return int(result[0])  # Преобразуем numeric в int
                return None
        except Exception as e:
            print(f"ERROR getting risk score for taxpayer {obj.taxpayer_id}: {e}")  # Отладочная информация
            return None


class DocumentSerializer(serializers.ModelSerializer):
    document_type_name = serializers.CharField(source='document_type.name', read_only=True)
    
    class Meta:
        model = Document
        fields = [
            'document_id', 'series', 'number', 'issued_by',
            'issued_date', 'expire_date', 'additional_info',
            'document_type_name'
        ]

class ContactDataSerializer(serializers.ModelSerializer):
    contact_type_name = serializers.CharField(source='contact_type.name', read_only=True)
    
    class Meta:
        model = ContactData
        fields = ['contact_id', 'value', 'contact_type_name']

class TaxpayerDetailSerializer(serializers.ModelSerializer):
    region_name = serializers.SerializerMethodField()
    tax_regime_name = serializers.SerializerMethodField()
    payer_type_name = serializers.SerializerMethodField()
    risk_score = serializers.SerializerMethodField()
    documents = DocumentSerializer(many=True, read_only=True)
    contacts = ContactDataSerializer(many=True, read_only=True)
    inspections = serializers.SerializerMethodField()
    taxable_objects = serializers.SerializerMethodField()
    declarations = serializers.SerializerMethodField()
    reduce_requests = serializers.SerializerMethodField()
    
    class Meta:
        model = Taxpayer
        fields = [
            'taxpayer_id', 'inn', 'fio', 'full_name', 'short_name',
            'birth_date', 'registration_address', 'fact_address',
            'ogrn', 'registration_date', 'bank_detals', 'start_date',
            'end_date', 'executive_list', 'payer_type_id', 'region_key',
            'tax_regime_id', 'payer_status_id', 'region_name', 'tax_regime_name', 'payer_type_name',  # ДОБАВЛЕНО payer_status_id
            'risk_score', 'documents', 'contacts', 'inspections',
            'taxable_objects', 'declarations', 'reduce_requests'
        ]
    
    def get_region_name(self, obj):
        try:
            region = Region.objects.get(region_id=obj.region_key)
            return region.name
        except Region.DoesNotExist:
            return "Не указан"
    
    def get_tax_regime_name(self, obj):
        try:
            regime = TaxRegime.objects.get(regime_id=obj.tax_regime_id)
            return regime.name
        except TaxRegime.DoesNotExist:
            return "Не указан"
    
    def get_payer_type_name(self, obj):
        payer_types = {
            1: "Физическое лицо",
            2: "Индивидуальный предприниматель", 
            3: "Юридическое лицо"
        }
        return payer_types.get(obj.payer_type_id, "Неизвестно")
    
    def get_risk_score(self, obj):
        try:
            with connection.cursor() as cursor:
                cursor.execute("""
                    SELECT rating_value 
                    FROM taxpayer_rating 
                    WHERE taxpayer_id = %s 
                    ORDER BY rating_date DESC, rating_id DESC 
                    LIMIT 1
                """, [obj.taxpayer_id])
                result = cursor.fetchone()
                print(f"DEBUG - Risk score query for taxpayer {obj.taxpayer_id}: {result}")  # Отладочная информация
                if result and result[0] is not None:
                    return int(result[0])  # Преобразуем numeric в int
                return None
        except Exception as e:
            print(f"ERROR getting risk score for taxpayer {obj.taxpayer_id}: {e}")  # Отладочная информация
            return None
    
    def get_inspections(self, obj):
        try:
            inspections = Inspection.objects.filter(taxpayer=obj)
            return [
                {
                    'inspection_id': inspection.inspection_id,
                    'inspection_date': inspection.inspection_date,
                    'inspection_type_id': inspection.inspection_type_id,
                    'inspection_reason': inspection.inspection_reason,
                    'inspection_type_status_id': inspection.inspection_type_status_id
                }
                for inspection in inspections
            ]
        except Exception:
            return []
    
    def get_taxable_objects(self, obj):
        try:
            ownerships = ObjectOwnership.objects.filter(taxpayer=obj).select_related('object')
            return ObjectOwnershipSerializer(ownerships, many=True).data
        except Exception:
            return []
    
    def get_declarations(self, obj):
        try:
            declarations = Declaration.objects.filter(taxpayer=obj).select_related('tax_type', 'period')
            return DeclarationListSerializer(declarations, many=True).data
        except Exception:
            return []
    
    def get_reduce_requests(self, obj):
        try:
            requests = TaxReduceRequest.objects.filter(taxpayer=obj).select_related('reduce_base', 'request_status', 'reduce_type')
            return TaxReduceRequestListSerializer(requests, many=True).data
        except Exception:
            return []
        
class TaxReduceRequestDetailSerializer(serializers.ModelSerializer):
    reduce_base_name = serializers.CharField(source='reduce_base.reduce_base_name', read_only=True)
    request_status_name = serializers.CharField(source='request_status.report_status_name', read_only=True)
    reduce_type_name = serializers.CharField(source='reduce_type.reduce_type_name', read_only=True)
    tax_officer_name = serializers.CharField(source='tax_officer.tax_officer_name', read_only=True)
    taxpayer_info = serializers.SerializerMethodField()
    periods = serializers.SerializerMethodField()
    tax_types = serializers.SerializerMethodField()
    # ДОБАВЛЕНО: поля для типа плательщика
    payer_type_id = serializers.IntegerField(source='taxpayer.payer_type_id', read_only=True)
    payer_type_name = serializers.SerializerMethodField()
    
    class Meta:
        model = TaxReduceRequest
        fields = [
            'request_id', 'send_date', 'requested_reduce_amount', 
            'full_description', 'reduce_base_name', 'request_status_name',
            'reduce_type_name', 'verdict_date', 'verdict_comment',
            'tax_officer_name', 'taxpayer_info', 'periods', 'tax_types',
            'request_status_id', 'payer_type_id', 'payer_type_name'  # ДОБАВЛЕНО
        ]

    def get_taxpayer_info(self, obj):
        taxpayer = obj.taxpayer
        return {
            'taxpayer_id': taxpayer.taxpayer_id,
            'inn': taxpayer.inn,
            'fio': taxpayer.fio,
            'full_name': taxpayer.full_name,
            'short_name': taxpayer.short_name,
            'registration_address': taxpayer.registration_address,
            'fact_address': taxpayer.fact_address,
            'payer_type_id': taxpayer.payer_type_id  # ДОБАВЛЕНО
        }

    def get_payer_type_name(self, obj):
        """Получает название типа плательщика"""
        payer_types = {
            1: "Физическое лицо",
            2: "Индивидуальный предприниматель", 
            3: "Юридическое лицо"
        }
        return payer_types.get(obj.taxpayer.payer_type_id, "Неизвестно")

    def get_periods(self, obj):
        """Получает периоды, связанные с заявлением"""
        try:
            with connection.cursor() as cursor:
                cursor.execute("""
                    SELECT tp.period_id, tp.start_date, tp.end_date, tp.period_type_id
                    FROM tax_period tp
                    INNER JOIN rax_period_tax_reduce_request rptrr ON tp.period_id = rptrr.period_id
                    WHERE rptrr.request_id = %s
                """, [obj.request_id])
                periods_data = cursor.fetchall()
            
            periods = []
            for row in periods_data:
                period = TaxPeriod(
                    period_id=row[0],
                    start_date=row[1],
                    end_date=row[2],
                    period_type_id=row[3]
                )
                periods.append({
                    'period_id': period.period_id,
                    'start_date': period.start_date,
                    'end_date': period.end_date,
                    'period_name': period.period_name
                })
            
            return periods
            
        except Exception as e:
            print(f"Error getting periods for request {obj.request_id}: {e}")
            return []

    def get_tax_types(self, obj):
        """Получает типы налогов, связанные с заявлением"""
        try:
            with connection.cursor() as cursor:
                cursor.execute("""
                    SELECT tt.tax_type_id, tt.tax_type_name
                    FROM tax_type tt
                    INNER JOIN tax_reduce_request_tax_type trrtt ON tt.tax_type_id = trrtt.tax_type_id
                    WHERE trrtt.request_id = %s
                """, [obj.request_id])
                tax_types_data = cursor.fetchall()
            
            tax_types = []
            for row in tax_types_data:
                tax_types.append({
                    'tax_type_id': row[0],
                    'tax_type_name': row[1]
                })
            
            return tax_types
            
        except Exception as e:
            print(f"Error getting tax types for request {obj.request_id}: {e}")
            return []
        
class TaxpayerUpdateSerializer(serializers.ModelSerializer):
    class Meta:
        model = Taxpayer
        fields = [
            'fio', 'full_name', 'short_name', 'birth_date',
            'registration_address', 'fact_address', 'ogrn',
            'bank_detals', 'executive_list', 'tax_regime_id', 'payer_status_id'
        ]
    
    def validate(self, data):
        taxpayer = self.instance
        
        # Валидация для физических лиц
        if taxpayer.payer_type_id == 1:
            if 'ogrn' in data and data['ogrn']:
                raise serializers.ValidationError("Физическое лицо не может иметь ОГРН")
            if 'full_name' in data and data['full_name']:
                raise serializers.ValidationError("Физическое лицо не может иметь полное наименование")
            if 'short_name' in data and data['short_name']:
                raise serializers.ValidationError("Физическое лицо не может иметь сокращенное наименование")
            if 'executive_list' in data and data['executive_list']:
                raise serializers.ValidationError("Физическое лицо не может иметь руководителей")
        
        # Валидация для ИП и Юрлиц
        elif taxpayer.payer_type_id in [2, 3]:
            if 'fio' in data and data['fio']:
                raise serializers.ValidationError("Юридическое лицо/ИП не может иметь ФИО")
        
        return data

class DocumentCreateSerializer(serializers.ModelSerializer):
    class Meta:
        model = Document
        fields = [
            'document_type', 'series', 'number', 'issued_by',
            'issued_date', 'expire_date', 'additional_info'
        ]

class DocumentUpdateSerializer(serializers.ModelSerializer):
    class Meta:
        model = Document
        fields = [
            'document_type', 'series', 'number', 'issued_by',
            'issued_date', 'expire_date', 'additional_info'
        ]

class ContactCreateSerializer(serializers.ModelSerializer):
    class Meta:
        model = ContactData
        fields = ['contact_type', 'value']

class ContactUpdateSerializer(serializers.ModelSerializer):
    class Meta:
        model = ContactData
        fields = ['contact_type', 'value']

class ObjectCreateSerializer(serializers.ModelSerializer):
    class Meta:
        model = TaxableObject
        fields = [
            'object_type', 'object_name', 'object_address',
            'cadastral_number', 'cadastral_value', 'transport_vin',
            'registration_plate', 'engine_power', 'real_estate_type'
        ]

class ObjectUpdateSerializer(serializers.ModelSerializer):
    class Meta:
        model = TaxableObject
        fields = [
            'object_type', 'object_name', 'object_address',
            'cadastral_number', 'cadastral_value', 'transport_vin',
            'registration_plate', 'engine_power', 'real_estate_type'
        ]

class ObjectOwnershipCreateSerializer(serializers.ModelSerializer):
    class Meta:
        model = ObjectOwnership
        fields = ['taxpayer', 'object', 'ownership_start_date', 'ownership_end_date']

class InspectionSerializer(serializers.Serializer):
    inspection_id = serializers.IntegerField()
    inspection_date = serializers.DateTimeField()
    inspection_type_id = serializers.IntegerField()
    inspection_reason = serializers.CharField()
    inspection_type_status_id = serializers.IntegerField()
    taxpayer = TaxpayerSerializer()

class InspectionDetailSerializer(serializers.Serializer):
    inspection_id = serializers.IntegerField()
    inspection_date = serializers.DateTimeField()
    inspection_type_id = serializers.IntegerField()
    inspection_reason = serializers.CharField()
    inspection_type_status_id = serializers.IntegerField()
    taxpayer = TaxpayerSerializer()
    participants = serializers.ListField()
    violations = serializers.ListField()