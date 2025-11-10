# This is an auto-generated Django model module.
# You'll have to do the following manually to clean this up:
#   * Rearrange models' order
#   * Make sure each model has one field with primary_key=True
#   * Make sure each ForeignKey and OneToOneField has `on_delete` set to the desired behavior
#   * Remove `managed = False` lines if you wish to allow Django to create, modify, and delete the table
# Feel free to rename the models, but don't rename db_table values or field names.
from django.db import models


class AccrualStatus(models.Model):
    accrual_status_id = models.AutoField(primary_key=True)
    accrual_status_name = models.TextField(blank=True, null=True)

    class Meta:
        managed = False
        db_table = 'accrual_status'


class CardCreateSource(models.Model):
    source_id = models.AutoField(primary_key=True)
    source_name = models.TextField(blank=True, null=True)

    class Meta:
        managed = False
        db_table = 'card_create_source'


class CheckStatusType(models.Model):
    check_status_type_id = models.AutoField(primary_key=True)
    check_status_type_name = models.TextField(blank=True, null=True)

    class Meta:
        managed = False
        db_table = 'check_status_type'


class ContactData(models.Model):
    contact_id = models.AutoField(primary_key=True)
    value = models.TextField(blank=True, null=True)
    contact_type = models.ForeignKey('ContactType', models.DO_NOTHING)
    taxpayer = models.ForeignKey('Taxpayer', models.DO_NOTHING)

    class Meta:
        managed = False
        db_table = 'contact_data'


class ContactType(models.Model):
    type_id = models.AutoField(primary_key=True)
    name = models.TextField(blank=True, null=True)

    class Meta:
        managed = False
        db_table = 'contact_type'


class DeclarationStatus(models.Model):
    declaration_status_id = models.AutoField(primary_key=True)
    declaration_status_name = models.TextField(blank=True, null=True)

    class Meta:
        managed = False
        db_table = 'declaration_status'


class Document(models.Model):    
    document_id = models.AutoField(primary_key=True)
    series = models.CharField(max_length=15, blank=True, null=True)
    number = models.CharField(max_length=30, blank=True, null=True)
    issued_by = models.TextField(blank=True, null=True)
    issued_date = models.DateField(blank=True, null=True)
    additional_info = models.TextField(blank=True, null=True)
    expire_date = models.DateField(blank=True, null=True)
    document_type = models.ForeignKey(
        'DocumentType', 
        models.DO_NOTHING, 
        db_column='"Ключ типа документа"',
        related_name='documents'
    )
    taxpayer = models.ForeignKey(
        'Taxpayer', 
        models.DO_NOTHING, 
        db_column='"Ключ налогоплательщика"',
        related_name='documents'
    )
    
    class Meta:
        managed = False
        db_table = 'document'


class DocumentType(models.Model):
    document_type_id = models.AutoField(primary_key=True)
    name = models.TextField(blank=True, null=True)

    class Meta:
        managed = False
        db_table = 'document_type'


class EmployersDeclaration(models.Model):
    attribute1 = models.BigIntegerField(db_column='Attribute1', blank=True, null=True)  # Field name made lowercase.

    class Meta:
        managed = False
        db_table = 'employers_declaration'


class IdentifiedViolation(models.Model):    
    violation_id = models.AutoField(primary_key=True)
    sum_to_pay = models.DecimalField(max_digits=20, decimal_places=2, blank=True, null=True)
    violation_type = models.ForeignKey('ViolationType', models.DO_NOTHING)
    period = models.ForeignKey('TaxPeriod', models.DO_NOTHING)
    inspection = models.ForeignKey('Inspection', models.DO_NOTHING)

    class Meta:
        managed = False
        db_table = 'identified_violation'


class Inspection(models.Model):
    inspection_id = models.AutoField(primary_key=True)
    inspection_date = models.DateTimeField(blank=True, null=True)
    taxpayer = models.ForeignKey('Taxpayer', models.DO_NOTHING)
    inspection_type = models.ForeignKey('InspectionType', models.DO_NOTHING)
    inspection_reason = models.ForeignKey('InspectionBase', models.DO_NOTHING, db_column='inspection_reason')
    inspection_type_status = models.ForeignKey(CheckStatusType, models.DO_NOTHING)

    class Meta:
        managed = False
        db_table = 'inspection'


class InspectionBase(models.Model):
    inspection_base_id = models.AutoField(primary_key=True)
    inspection_base_name = models.TextField()

    class Meta:
        managed = False
        db_table = 'inspection_base'


class InspectionType(models.Model):
    inspection_type_id = models.AutoField(primary_key=True)
    inspection_name_id = models.TextField(blank=True, null=True)

    class Meta:
        managed = False
        db_table = 'inspection_type'


class Kbk(models.Model):
    kbk_id = models.AutoField(primary_key=True)
    kbk_code = models.CharField(max_length=20, blank=True, null=True)
    kbk_description = models.TextField(blank=True, null=True)

    class Meta:
        managed = False
        db_table = 'kbk'


class ObjectOwnership(models.Model):    
    ownership_id = models.AutoField(primary_key=True)
    ownership_start_date = models.DateField(blank=True, null=True)
    ownership_end_date = models.DateField(blank=True, null=True)
    taxpayer = models.ForeignKey('Taxpayer', models.DO_NOTHING)
    object = models.ForeignKey('TaxableObject', models.DO_NOTHING)

    class Meta:
        managed = False
        db_table = 'object_ownership'


class ObjectType(models.Model):
    object_type_id = models.AutoField(primary_key=True)
    object_type_name = models.TextField(blank=True, null=True)

    class Meta:
        managed = False
        db_table = 'object_type'


class Okved(models.Model):
    okved_id = models.AutoField(primary_key=True)
    code = models.CharField(max_length=8, blank=True, null=True)
    description = models.TextField(blank=True, null=True)

    class Meta:
        managed = False
        db_table = 'okved'


class OkvedTaxpayer(models.Model):
    okved_id = models.IntegerField()
    id_taxpayer = models.IntegerField()

    class Meta:
        managed = False
        db_table = 'okved_taxpayer'


class Opf(models.Model):
    opf_id = models.AutoField(primary_key=True)
    name = models.TextField(blank=True, null=True)

    class Meta:
        managed = False
        db_table = 'opf'


class PeriodType(models.Model):
    type_period_id = models.AutoField(primary_key=True)
    name = models.TextField(blank=True, null=True)

    class Meta:
        managed = False
        db_table = 'period_type'


class RaxPeriodTaxReduceRequest(models.Model):
    period_id = models.IntegerField()
    request_id = models.IntegerField()

    class Meta:
        managed = False
        db_table = 'rax_period_tax_reduce_request'


class RealEstateType(models.Model):
    real_estate_type_id = models.AutoField(primary_key=True)
    real_estate_type_name = models.TextField(blank=True, null=True)

    class Meta:
        managed = False
        db_table = 'real_estate_type'


class ReduceBase(models.Model):
    reduce_base_id = models.AutoField(primary_key=True)
    reduce_base_name = models.TextField(blank=True, null=True)
    reduce_ground = models.TextField(blank=True, null=True)

    class Meta:
        managed = False
        db_table = 'reduce_base'


class ReduceType(models.Model):
    reduce_type_id = models.AutoField(primary_key=True)
    reduce_type_name = models.TextField(blank=True, null=True)

    class Meta:
        managed = False
        db_table = 'reduce_type'


class Region(models.Model):
    region_id = models.AutoField(primary_key=True)
    name = models.TextField(blank=True, null=True)
    code = models.CharField(max_length=3, blank=True, null=True)

    class Meta:
        managed = False
        db_table = 'region'


class ReportStatus(models.Model):
    report_status_id = models.AutoField(primary_key=True)
    report_status_name = models.TextField(blank=True, null=True)

    class Meta:
        managed = False
        db_table = 'report_status'


class RiskFactor(models.Model):
    risk_factor_id = models.AutoField(primary_key=True)
    factor_name = models.TextField(blank=True, null=True)
    factor_description = models.TextField(blank=True, null=True)

    class Meta:
        managed = False
        db_table = 'risk_factor'


class Role(models.Model):
    role_id = models.AutoField(primary_key=True)
    role_name = models.TextField(blank=True, null=True)

    class Meta:
        managed = False
        db_table = 'role'


class TaxAccrual(models.Model):
    tax_accrual_id = models.AutoField(primary_key=True)
    accrual_date = models.DateTimeField(blank=True, null=True)
    accrual_amount = models.DecimalField(max_digits=20, decimal_places=2, blank=True, null=True)
    percent_amount = models.DecimalField(max_digits=20, decimal_places=2, blank=True, null=True)
    tax_type = models.ForeignKey('TaxType', models.DO_NOTHING)
    income_status = models.ForeignKey(AccrualStatus, models.DO_NOTHING)
    ownership = models.ForeignKey(ObjectOwnership, models.DO_NOTHING, blank=True, null=True)
    declaration = models.ForeignKey('TaxDeclaration', models.DO_NOTHING, blank=True, null=True)
    taxpayer_id = models.IntegerField(blank=True, null=True)
    object_id = models.IntegerField(blank=True, null=True)
    due_date = models.DateField(blank=True, null=True)

    class Meta:
        managed = False
        db_table = 'tax_accrual'


class TaxDeclaration(models.Model):
    declaration_id = models.AutoField(primary_key=True)
    submission_date = models.DateTimeField(blank=True, null=True)
    tax_sum = models.DecimalField(max_digits=20, decimal_places=2, blank=True, null=True)
    total_income = models.DecimalField(max_digits=20, decimal_places=2, blank=True, null=True)
    taxpayer = models.ForeignKey('Taxpayer', models.DO_NOTHING)
    period = models.ForeignKey('TaxPeriod', models.DO_NOTHING)
    tax_type = models.ForeignKey('TaxType', models.DO_NOTHING)
    declaration_status = models.ForeignKey(DeclarationStatus, models.DO_NOTHING)

    class Meta:
        managed = False
        db_table = 'tax_declaration'


class TaxOfficer(models.Model):
    tax_officer_id = models.AutoField(primary_key=True)
    tax_officer_name = models.TextField(blank=True, null=True)
    unit = models.TextField(blank=True, null=True)
    role = models.ForeignKey(Role, models.DO_NOTHING)

    class Meta:
        managed = False
        db_table = 'tax_officer'


class TaxOfficerInspection(models.Model):
    tax_officer_id = models.IntegerField()
    inspection_id = models.IntegerField()

    class Meta:
        managed = False
        db_table = 'tax_officer_inspection'


class TaxPayment(models.Model):
    payment_id = models.AutoField(primary_key=True)
    payment_date = models.DateTimeField(blank=True, null=True)
    payment_amount = models.DecimalField(max_digits=20, decimal_places=2, blank=True, null=True)
    debit_account = models.CharField(max_length=20, blank=True, null=True)
    credit_account = models.CharField(max_length=20, blank=True, null=True)
    kbk = models.ForeignKey(Kbk, models.DO_NOTHING)
    tax_income = models.ForeignKey(TaxAccrual, models.DO_NOTHING)

    class Meta:
        managed = False
        db_table = 'tax_payment'


class TaxPeriod(models.Model):
    period_id = models.AutoField(primary_key=True)
    start_date = models.DateField(blank=True, null=True)
    end_date = models.DateField(blank=True, null=True)
    period_type = models.ForeignKey(PeriodType, models.DO_NOTHING)

    class Meta:
        managed = False
        db_table = 'tax_period'


class TaxReduceRequest(models.Model):
    request_id = models.AutoField(primary_key=True)
    send_date = models.DateTimeField(blank=True, null=True)
    requested_reduce_amount = models.DecimalField(max_digits=20, decimal_places=2, blank=True, null=True)
    full_description = models.TextField(blank=True, null=True)
    verdict_date = models.DateTimeField(blank=True, null=True)
    reduce_base = models.ForeignKey(ReduceBase, models.DO_NOTHING)
    request_status = models.ForeignKey(ReportStatus, models.DO_NOTHING)
    taxpayer = models.ForeignKey('Taxpayer', models.DO_NOTHING)
    
    tax_officer = models.ForeignKey(
        TaxOfficer, 
        models.DO_NOTHING, 
        db_column='"Ключ сотрудника"',
        related_name='handled_requests'
    )    
    reduce_type = models.ForeignKey(
        ReduceType, 
        models.DO_NOTHING, 
        db_column='"Ключ типа снижения"',
        related_name='requests_by_type'
    )

    class Meta:
        managed = False
        db_table = 'tax_reduce_request'


class TaxReduceRequestTaxType(models.Model):
    request_id = models.IntegerField()
    tax_type_id = models.IntegerField()

    class Meta:
        managed = False
        db_table = 'tax_reduce_request_tax_type'


class TaxRegime(models.Model):
    regime_id = models.AutoField(primary_key=True)
    name = models.TextField(blank=True, null=True)
    description = models.TextField(blank=True, null=True)

    class Meta:
        managed = False
        db_table = 'tax_regime'


class TaxType(models.Model):
    tax_type_id = models.AutoField(primary_key=True)
    tax_type_name = models.TextField(blank=True, null=True)
    tax_type_description = models.TextField(blank=True, null=True)

    class Meta:
        managed = False
        db_table = 'tax_type'


class TaxableObject(models.Model):
    object_id = models.AutoField(primary_key=True)
    object_name = models.TextField(blank=True, null=True)
    cadastral_number = models.CharField(max_length=16, blank=True, null=True)
    object_address = models.TextField(blank=True, null=True)
    cadastral_value = models.DecimalField(max_digits=20, decimal_places=2, blank=True, null=True)
    transport_vin = models.CharField(max_length=17, blank=True, null=True)
    registration_plate = models.CharField(max_length=9, blank=True, null=True)
    transport_model = models.TextField(blank=True, null=True)
    extra_value = models.DecimalField(max_digits=20, decimal_places=2, blank=True, null=True)
    object_type = models.ForeignKey(ObjectType, models.DO_NOTHING)
    real_estate_type = models.ForeignKey(RealEstateType, models.DO_NOTHING, blank=True, null=True)
    engine_power = models.IntegerField(blank=True, null=True)

    class Meta:
        managed = False
        db_table = 'taxable_object'


class Taxpayer(models.Model):
    taxpayer_id = models.AutoField(primary_key=True)
    inn = models.CharField(max_length=12, blank=True, null=True)
    creation_date = models.DateTimeField(blank=True, null=True)
    notes = models.TextField(blank=True, null=True)
    update_date = models.DateTimeField(blank=True, null=True)
    fio = models.TextField(blank=True, null=True)
    birth_date = models.DateField(blank=True, null=True)
    registration_address = models.TextField(blank=True, null=True)
    fact_address = models.TextField(blank=True, null=True)
    ogrn = models.CharField(max_length=15, blank=True, null=True)
    registration_date = models.DateField(blank=True, null=True)
    bank_detals = models.CharField(max_length=20, blank=True, null=True)
    start_date = models.DateField(blank=True, null=True)
    end_date = models.DateField(blank=True, null=True)
    full_name = models.TextField(blank=True, null=True)
    short_name = models.TextField(blank=True, null=True)
    executive_list = models.TextField(blank=True, null=True)
    payer_status = models.ForeignKey('TaxpayerStatus', models.DO_NOTHING)
    region_key = models.ForeignKey(Region, models.DO_NOTHING, db_column='region_key')
    opf = models.ForeignKey(Opf, models.DO_NOTHING)
    tax_regime = models.ForeignKey(TaxRegime, models.DO_NOTHING)
    payer_type = models.ForeignKey('TaxpayerType', models.DO_NOTHING)
    origin = models.ForeignKey(CardCreateSource, models.DO_NOTHING)

    class Meta:
        managed = False
        db_table = 'taxpayer'


class TaxpayerRating(models.Model):
    rating_id = models.AutoField(primary_key=True)
    rating_date = models.DateTimeField(blank=True, null=True)
    rating_value = models.DecimalField(max_digits=3, decimal_places=0, blank=True, null=True)
    taxpayer = models.ForeignKey(Taxpayer, models.DO_NOTHING)

    class Meta:
        managed = False
        db_table = 'taxpayer_rating'


class TaxpayerStatus(models.Model):
    status_id = models.AutoField(primary_key=True)
    name = models.TextField(blank=True, null=True)

    class Meta:
        managed = False
        db_table = 'taxpayer_status'


class TaxpayerType(models.Model):
    id_taxpayer_type = models.AutoField(primary_key=True)
    name = models.TextField(blank=True, null=True)

    class Meta:
        managed = False
        db_table = 'taxpayer_type'


class ViolationType(models.Model):
    violation_type_id = models.AutoField(primary_key=True)
    violation_name = models.TextField(blank=True, null=True)
    violation_code = models.CharField(max_length=3, blank=True, null=True)

    class Meta:
        managed = False
        db_table = 'violation_type'


class RiskFactorRating(models.Model):
    risk_factor_id = models.IntegerField()
    rating_id = models.IntegerField()

    class Meta:
        managed = False
        db_table = '"Факторы риска_Оценка риска налого"'
