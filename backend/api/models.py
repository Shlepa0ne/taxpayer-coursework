from django.db import models

# Модель, описывающая налогоплательщика.
# models.py
class Taxpayer(models.Model):
    taxpayer_id = models.AutoField(primary_key=True)
    inn = models.CharField(max_length=12, unique=True)
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
    payer_status_id = models.IntegerField()
    region_key = models.IntegerField()
    opf_id = models.IntegerField()
    tax_regime_id = models.IntegerField()
    payer_type_id = models.IntegerField()  # Добавьте это поле
    origin_id = models.IntegerField()

    class Meta:
        managed = False
        db_table = 'taxpayer'

# Модель для налоговых начислений.
class TaxAccrual(models.Model):
    tax_accrual_id = models.AutoField(primary_key=True)
    taxpayer = models.ForeignKey(Taxpayer, on_delete=models.DO_NOTHING)
    accrual_date = models.DateTimeField(blank=True, null=True)
    accrual_amount = models.DecimalField(max_digits=20, decimal_places=2, blank=True, null=True)
    due_date = models.DateField(blank=True, null=True)

    class Meta:
        managed = False
        db_table = 'tax_accrual'

# Справочник оснований для снижения налога.
class ReduceBase(models.Model):
    reduce_base_id = models.AutoField(primary_key=True)
    reduce_base_name = models.TextField(blank=True, null=True)

    class Meta:
        managed = False
        db_table = 'reduce_base'

# Справочник статусов для заявлений.
class ReportStatus(models.Model):
    report_status_id = models.AutoField(primary_key=True)
    report_status_name = models.TextField(blank=True, null=True)

    class Meta:
        managed = False
        db_table = 'report_status'

# Модель, описывающая сотрудника налоговой службы.
class TaxOfficer(models.Model):
    tax_officer_id = models.AutoField(primary_key=True)
    tax_officer_name = models.TextField(blank=True, null=True)

    class Meta:
        managed = False
        db_table = 'tax_officer'

# Справочник типов снижения налога.
class ReduceType(models.Model):
    reduce_type_id = models.AutoField(primary_key=True)
    reduce_type_name = models.TextField(blank=True, null=True)
    
    class Meta:
        managed = False
        db_table = 'reduce_type'

# Модель для заявлений на снижение налога.
class TaxReduceRequest(models.Model):
    request_id = models.AutoField(primary_key=True)
    taxpayer = models.ForeignKey(Taxpayer, on_delete=models.DO_NOTHING)
    send_date = models.DateTimeField(blank=True, null=True)
    requested_reduce_amount = models.DecimalField(max_digits=20, decimal_places=2, blank=True, null=True)
    full_description = models.TextField(blank=True, null=True)
    reduce_base = models.ForeignKey(ReduceBase, on_delete=models.DO_NOTHING)
    verdict_date = models.DateTimeField(blank=True, null=True)
    request_status = models.ForeignKey(ReportStatus, on_delete=models.DO_NOTHING)
    # Указываем реальное имя колонки в унаследованной БД.
    tax_officer = models.ForeignKey(TaxOfficer, on_delete=models.DO_NOTHING, db_column='"Ключ сотрудника"')
    # Указываем реальное имя колонки для типа снижения.
    reduce_type = models.ForeignKey(ReduceType, on_delete=models.DO_NOTHING, db_column='"Ключ типа снижения"')
    
    class Meta:
        managed = False
        db_table = 'tax_reduce_request'


class TaxpayerAuth(models.Model):
    inn = models.CharField(max_length=32, primary_key=True)  # INN как уникальный идентификатор
    password_hash = models.CharField(max_length=512)        # хеш пароля

    class Meta:
        managed = False
        db_table = 'taxpayer_auth'  # имя таблицы в БД


class WorkerAuth(models.Model):
    inn = models.CharField(max_length=32, primary_key=True)
    password_hash = models.CharField(max_length=512)

    class Meta:
        managed = False
        db_table = 'worker_auth'


# Модели для налогооблагаемых объектов
class ObjectType(models.Model):
    object_type_id = models.AutoField(primary_key=True)
    object_type_name = models.TextField(blank=True, null=True)

    class Meta:
        managed = False
        db_table = 'object_type'

class RealEstateType(models.Model):
    real_estate_type_id = models.AutoField(primary_key=True)
    real_estate_type_name = models.TextField(blank=True, null=True)

    class Meta:
        managed = False
        db_table = 'real_estate_type'

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
    object_type = models.ForeignKey(ObjectType, on_delete=models.DO_NOTHING)
    real_estate_type = models.ForeignKey(RealEstateType, on_delete=models.DO_NOTHING, blank=True, null=True)
    engine_power = models.IntegerField(blank=True, null=True)

    class Meta:
        managed = False
        db_table = 'taxable_object'

class ObjectOwnership(models.Model):
    ownership_id = models.AutoField(primary_key=True)
    ownership_start_date = models.DateField(blank=True, null=True)
    ownership_end_date = models.DateField(blank=True, null=True)
    taxpayer = models.ForeignKey(Taxpayer, on_delete=models.DO_NOTHING)
    object = models.ForeignKey(TaxableObject, on_delete=models.DO_NOTHING)

    class Meta:
        managed = False
        db_table = 'object_ownership'