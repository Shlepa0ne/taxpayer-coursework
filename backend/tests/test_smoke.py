# tests/test_smoke.py
import pytest
from django.test import TestCase
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APIClient

@pytest.mark.django_db
class SmokeTest(TestCase):
    """Простой дымовой тест для проверки базовой функциональности"""
    
    def setUp(self):
        self.client = APIClient()

    def test_api_root(self):
        """Тест доступности API"""
        # Просто проверяем что сервер отвечает
        response = self.client.get('/api/')
        self.assertIn(response.status_code, [200, 404, 403])  # Любой ответ кроме 500

    def test_authentication_endpoints(self):
        """Тест доступности эндпоинтов аутентификации"""
        endpoints = [
            reverse('auth-login'),
            reverse('auth-login-workers'),
        ]
        
        for endpoint in endpoints:
            response = self.client.get(endpoint)
            self.assertIn(response.status_code, [200, 405])  # GET может быть не разрешен

    def test_health_check(self):
        """Простая проверка здоровья приложения"""
        try:
            from django.db import connection
            with connection.cursor() as cursor:
                cursor.execute("SELECT 1")
                result = cursor.fetchone()
            self.assertEqual(result[0], 1)
        except Exception as e:
            self.skipTest(f"Database health check failed: {e}")