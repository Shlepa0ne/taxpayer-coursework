# Импортируем permission-классы
from rest_framework import generics
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from rest_framework.permissions import IsAuthenticated # Добавляем импорт
from django.db import connection
from .models import Taxpayer
from .serializers import TaxpayerSerializer, RiskScoreInputSerializer, RiskScoreOutputSerializer

class TaxpayerListAPIView(generics.ListAPIView):
    """
    Представление для получения списка всех налогоплательщиков.
    GET /api/taxpayers/
    """
    queryset = Taxpayer.objects.all()
    serializer_class = TaxpayerSerializer
    permission_classes = [IsAuthenticated] # Только для аутентифицированных пользователей

class TaxpayerDetailAPIView(generics.RetrieveAPIView):
    """
    Представление для получения детальной информации об одном налогоплательщике.
    GET /api/taxpayers/<int:pk>/
    """
    queryset = Taxpayer.objects.all()
    serializer_class = TaxpayerSerializer
    permission_classes = [IsAuthenticated] # Только для аутентифицированных пользователей

class CalculateRiskScoreAPIView(APIView):
    """
    API View для расчета RiskScore налогоплательщика.
    Принимает POST-запрос с 'taxpayer_id'.
    POST /api/calculate-risk-score/
    """
    permission_classes = [IsAuthenticated] # Только для аутентифицированных пользователей

    def post(self, request, *args, **kwargs):
        # 1. Валидация входных данных с помощью сериализатора
        input_serializer = RiskScoreInputSerializer(data=request.data)
        if not input_serializer.is_valid():
            return Response(
                input_serializer.errors, 
                status=status.HTTP_400_BAD_REQUEST
            )

        # 2. Извлечение проверенных данных
        taxpayer_id = input_serializer.validated_data['taxpayer_id']

        # 3. Прямое выполнение SQL-запроса к базе данных
        try:
            # Создаем курсор для выполнения запроса
            with connection.cursor() as cursor:
                # Вызываем хранимую функцию PostgreSQL 'calculate_risk_score'
                # Используем параметры %s для безопасной передачи данных
                cursor.execute("SELECT calculate_risk_score(%s)", [taxpayer_id])
                
                # Получаем результат. fetchone() возвращает кортеж, например, (50,)
                result = cursor.fetchone()

            if result is None:
                return Response(
                    {"error": "Функция не вернула результат."},
                    status=status.HTTP_404_NOT_FOUND
                )
            
            # Извлекаем значение из кортежа
            risk_score_value = result[0]

            # 4. Форматирование выходных данных с помощью сериализатора
            output_serializer = RiskScoreOutputSerializer(data={'risk_score': risk_score_value})
            output_serializer.is_valid(raise_exception=True)

            return Response(output_serializer.data, status=status.HTTP_200_OK)

        except Exception as e:
            # Обработка возможных ошибок (например, налогоплательщик не найден)
            return Response(
                {"error": f"Произошла ошибка при выполнении запроса: {str(e)}"},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )