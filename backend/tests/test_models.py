from django.test import TestCase
from django.utils import timezone
from datetime import date, timedelta
from api.models import *
import pytest

class TaxpayerModelTest(TestCase):
    def setUp(self):
        self.taxpayer = Taxpayer.objects.create(
            inn='123456789012',
            fio='Иванов Иван Иванович',
            payer_type_id=1,
            region_key=1,
            tax_regime_id=1,
            payer_status_id=1,
            opf_id=1,
            origin_id=1
        )

    @pytest.mark.django_db
    def test_taxpayer_creation(self):
        self.assertEqual(self.taxpayer.inn, '123456789012')
        self.assertEqual(self.taxpayer.fio, 'Иванов Иван Иванович')
        self.assertTrue(isinstance(self.taxpayer, Taxpayer))

    @pytest.mark.django_db
    def test_taxpayer_str_representation(self):
        # Теперь должно работать с методом __str__
        taxpayer_str = str(self.taxpayer)
        self.assertIn('123456789012', taxpayer_str)

class TaxAccrualModelTest(TestCase):
    def setUp(self):
        self.taxpayer = Taxpayer.objects.create(
            inn='123456789012',
            payer_type_id=1,
            region_key=1,
            tax_regime_id=1,
            payer_status_id=1,
            opf_id=1,
            origin_id=1
        )
        self.tax_accrual = TaxAccrual.objects.create(
            taxpayer=self.taxpayer,
            accrual_amount=1000.00,
            due_date=date.today() + timedelta(days=30),
            income_status_id=1,
            tax_type_id=13
        )

    def test_tax_accrual_creation(self):
        self.assertEqual(self.tax_accrual.accrual_amount, 1000.00)
        self.assertEqual(self.tax_accrual.taxpayer, self.taxpayer)