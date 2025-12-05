# tests/test_security.py
import pytest
from django.test import TestCase
from rest_framework.test import APIClient
from rest_framework import status
from django.contrib.auth.hashers import make_password
from django.utils import timezone
from api.models import *

@pytest.mark.django_db
class SecurityTest(TestCase):
    def setUp(self):
        self.client = APIClient()
        
        # Используем уникальные ID
        self.taxpayer1 = Taxpayer.objects.create(
            taxpayer_id=20001,  # Уникальный ID
            inn='111111111111',
            payer_type_id=1,
            region_key=9991,
            tax_regime_id=9991,
            payer_status_id=1,
            opf_id=1,
            origin_id=1
        )
        self.taxpayer2 = Taxpayer.objects.create(
            taxpayer_id=20002,  # Уникальный ID
            inn='222222222222',
            payer_type_id=1,
            region_key=9991,
            tax_regime_id=9991,
            payer_status_id=1,
            opf_id=1,
            origin_id=1
        )
        
        TaxpayerAuth.objects.create(
            inn='111111111111',
            password_hash=make_password('password1')
        )
        TaxpayerAuth.objects.create(
            inn='222222222222',
            password_hash=make_password('password2')
        )
        
        # Используем существующие объекты вместо создания новых
        self.reduce_base = ReduceBase.objects.get(reduce_base_id=9991)
        self.reduce_type = ReduceType.objects.get(reduce_type_id=9991)
        self.tax_officer = TaxOfficer.objects.get(tax_officer_id=9991)
        self.report_status = ReportStatus.objects.get(report_status_id=9991)

    def test_cannot_access_other_user_data(self):
        # Создаем заявление для пользователя 2
        request_user2 = TaxReduceRequest.objects.create(
            taxpayer=self.taxpayer2,
            send_date=timezone.now(),
            requested_reduce_amount=1000,
            full_description='Заявление пользователя 2',
            reduce_base=self.reduce_base,
            request_status=self.report_status,
            tax_officer=self.tax_officer,
            reduce_type=self.reduce_type
        )
        
        # Получаем токен для пользователя 1
        from rest_framework_simplejwt.tokens import RefreshToken
        refresh = RefreshToken()
        refresh['inn'] = '111111111111'
        refresh['user_type'] = 'taxpayer'
        token_user1 = str(refresh.access_token)
        
        # Пользователь 1 пытается получить доступ к заявлению пользователя 2
        self.client.credentials(HTTP_AUTHORIZATION=f'Bearer {token_user1}')
        response = self.client.get(f'/api/my-requests/{request_user2.request_id}/')
        
        # Должен получить 404 или 403
        self.assertIn(response.status_code, [status.HTTP_404_NOT_FOUND, status.HTTP_403_FORBIDDEN])