from django.test import TestCase, Client
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APITestCase, APIClient
from django.contrib.auth.hashers import make_password
from api.models import *

class TaxpayerAPITest(APITestCase):
    def setUp(self):
        self.client = APIClient()
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
        TaxpayerAuth.objects.create(
            inn='123456789012',
            password_hash=make_password('testpassword')
        )