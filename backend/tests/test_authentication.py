# tests/test_authentication.py
import pytest
from django.test import TestCase
from rest_framework import status
from rest_framework.test import APIClient

class InnAuthenticationTest(TestCase):
    def setUp(self):
        from api.authentication import InnAuthentication, AuthenticatedUser
        self.auth = InnAuthentication()
        self.valid_inn = '123456789012'
        self.valid_user_type = 'taxpayer'

    def test_user_properties(self):
        from api.authentication import AuthenticatedUser
        user = AuthenticatedUser(self.valid_inn, self.valid_user_type)
        self.assertEqual(user.username, self.valid_inn)
        self.assertEqual(user.inn, self.valid_inn)
        self.assertEqual(user.user_type, self.valid_user_type)
        self.assertTrue(user.is_authenticated)

    def test_user_is_authenticated_property(self):
        from api.authentication import AuthenticatedUser
        user = AuthenticatedUser(self.valid_inn, self.valid_user_type)
        self.assertTrue(user.is_authenticated)

@pytest.mark.django_db
class TestWithDatabase:
    def test_taxpayer_creation(self, taxpayer_user):
        assert taxpayer_user.inn == '123456789012'
        assert taxpayer_user.fio == 'Тестовый пользователь'

    def test_authentication_flow(self, authenticated_taxpayer_client):
        response = authenticated_taxpayer_client.get('/api/current-taxpayer/')
        assert response.status_code == status.HTTP_200_OK

    def test_worker_authentication(self, authenticated_worker_client):
        response = authenticated_worker_client.get('/api/worker/current/')
        assert response.status_code == status.HTTP_200_OK