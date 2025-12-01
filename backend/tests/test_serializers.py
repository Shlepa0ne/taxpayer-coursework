from django.test import TestCase
from rest_framework.exceptions import ValidationError
from api.models import *
from api.serializers import *

class TaxpayerSerializerTest(TestCase):
    def setUp(self):
        self.taxpayer_data = {
            'inn': '123456789012',
            'fio': 'Иванов Иван Иванович',
            'payer_type_id': 1
        }
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

    def test_taxpayer_serializer_valid_data(self):
        serializer = TaxpayerSerializer(instance=self.taxpayer)
        data = serializer.data
        self.assertEqual(data['inn'], self.taxpayer_data['inn'])
        self.assertEqual(data['fio'], self.taxpayer_data['fio'])

class TaxReduceRequestSerializerTest(TestCase):
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
        self.reduce_base = ReduceBase.objects.create(
            reduce_base_name='Тестовое основание'
        )

    def test_tax_reduce_request_serializer_valid_data(self):
        data = {
            'requested_reduce_amount': 1000.00,
            'full_description': 'Тестовое описание',
            'reduce_base': self.reduce_base.reduce_base_id,
            'reduce_type': 1,
            'tax_types': [13, 14],
            'periods': [
                {
                    'start_date': '2024-01-01',
                    'end_date': '2024-03-31'
                }
            ]
        }
        serializer = TaxReduceRequestSerializer(data=data)
        self.assertTrue(serializer.is_valid())

    def test_tax_reduce_request_serializer_invalid_data(self):
        data = {
            'requested_reduce_amount': -100,  # Отрицательная сумма
            'full_description': '',
            'reduce_base': self.reduce_base.reduce_base_id
        }
        serializer = TaxReduceRequestSerializer(data=data)
        self.assertFalse(serializer.is_valid())

class LoginSerializerTest(TestCase):
    def test_login_serializer_valid_data(self):
        data = {
            'inn': '123456789012',
            'password': 'testpassword123'
        }
        serializer = LoginSerializer(data=data)
        self.assertTrue(serializer.is_valid())

    def test_login_serializer_missing_fields(self):
        data = {
            'inn': '123456789012'
            # password отсутствует
        }
        serializer = LoginSerializer(data=data)
        self.assertFalse(serializer.is_valid())
        self.assertIn('password', serializer.errors)

class ChangePasswordSerializerTest(TestCase):
    def test_change_password_serializer_valid_data(self):
        data = {
            'current_password': 'oldpassword',
            'new_password': 'newpassword123',
            'confirm_password': 'newpassword123'
        }
        serializer = ChangePasswordSerializer(data=data)
        self.assertTrue(serializer.is_valid())

    def test_change_password_serializer_password_mismatch(self):
        data = {
            'current_password': 'oldpassword',
            'new_password': 'newpassword123',
            'confirm_password': 'differentpassword'
        }
        serializer = ChangePasswordSerializer(data=data)
        self.assertFalse(serializer.is_valid())
        self.assertIn('non_field_errors', serializer.errors)