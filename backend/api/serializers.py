from rest_framework import serializers
from .models import Taxpayer
from django.contrib.auth import get_user_model

class TaxpayerSerializer(serializers.ModelSerializer):
    """
    Сериализатор для модели Налогоплательщика.
    Он будет преобразовывать данные модели в JSON и обратно.
    """
    class Meta:
        model = Taxpayer
        fields = [
            'taxpayer_id',
            'full_name', 
            'short_name', 
            'inn',
        ]

class RiskScoreInputSerializer(serializers.Serializer):
    """
    Сериализатор для валидации входных данных: ID налогоплательщика.
    """
    taxpayer_id = serializers.IntegerField(
        required=True, 
        help_text="ID налогоплательщика для расчета RiskScore"
    )

class RiskScoreOutputSerializer(serializers.Serializer):
    """
    Сериализатор для представления выходных данных: рассчитанного RiskScore.
    """
    risk_score = serializers.IntegerField(help_text="Рассчитанный RiskScore")

# Получаем активную модель пользователя Django
User = get_user_model()

class UserDetailsSerializer(serializers.ModelSerializer):
    """
    Сериализатор для модели пользователя. 
    Будет использоваться для отображения информации о пользователе при логине.
    """
    class Meta:
        model = User
        # Явно перечисляем поля, которые хотим видеть в ответе
        fields = ('pk', 'username', 'email', 'first_name', 'last_name')
        # Указываем, что все эти поля только для чтения
        read_only_fields = fields