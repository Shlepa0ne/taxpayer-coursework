from rest_framework import generics, status, serializers, permissions, serializers
from rest_framework.views import APIView
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from django.db import connection
from django.utils import timezone
from .models import Taxpayer, TaxAccrual, TaxReduceRequest, ReduceBase, ReportStatus, TaxOfficer, ReduceType, TaxpayerAuth, WorkerAuth
from .serializers import (
    TaxpayerSerializer,
    TaxAccrualSerializer,
    TaxReduceRequestSerializer,
    RiskScoreInputSerializer,
    RiskScoreOutputSerializer,
    ReduceBaseSerializer,
    LoginSerializer
)
from django.contrib.auth.hashers import check_password
from rest_framework_simplejwt.tokens import RefreshToken
from rest_framework_simplejwt.views import TokenRefreshView
from rest_framework_simplejwt.tokens import RefreshToken
from rest_framework.response import Response
from .authentication import InnAuthentication


class TaxpayerListAPIView(generics.ListAPIView):
    queryset = Taxpayer.objects.all()
    serializer_class = TaxpayerSerializer
    permission_classes = [IsAuthenticated]

class TaxpayerDetailAPIView(generics.RetrieveAPIView):
    queryset = Taxpayer.objects.all()
    serializer_class = TaxpayerSerializer
    permission_classes = [IsAuthenticated]

class CalculateRiskScoreAPIView(APIView):
    permission_classes = [IsAuthenticated]
    def post(self, request, *args, **kwargs):
        input_serializer = RiskScoreInputSerializer(data=request.data)
        if not input_serializer.is_valid():
            return Response(input_serializer.errors, status=status.HTTP_400_BAD_REQUEST)
        taxpayer_id = input_serializer.validated_data['taxpayer_id']
        try:
            with connection.cursor() as cursor:
                cursor.execute("SELECT calculate_risk_score(%s)", [taxpayer_id])
                result = cursor.fetchone()
            if result is None:
                return Response({"error": "Функция не вернула результат."}, status=status.HTTP_404_NOT_FOUND)
            risk_score_value = result[0]
            output_serializer = RiskScoreOutputSerializer(data={'risk_score': risk_score_value})
            output_serializer.is_valid(raise_exception=True)
            return Response(output_serializer.data, status=status.HTTP_200_OK)
        except Exception as e:
            return Response({"error": f"Ошибка выполнения запроса: {str(e)}"}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

class MyTaxAccrualsAPIView(generics.ListAPIView):
    serializer_class = TaxAccrualSerializer
    permission_classes = [IsAuthenticated]
    authentication_classes = [InnAuthentication]  # Добавьте эту строку
    
    def get_queryset(self):
        user = self.request.user
        user_inn = user.username
        return TaxAccrual.objects.filter(taxpayer__inn=user_inn)

# Добавьте authentication_classes ко всем защищенным View
class ReduceBaseListAPIView(generics.ListAPIView):
    queryset = ReduceBase.objects.all()
    serializer_class = ReduceBaseSerializer
    permission_classes = [IsAuthenticated]
    authentication_classes = [InnAuthentication]  # Добавьте

class CreateTaxReduceRequestAPIView(generics.CreateAPIView):
    serializer_class = TaxReduceRequestSerializer
    permission_classes = [IsAuthenticated]
    authentication_classes = [InnAuthentication]  # Убедитесь, что он есть

    def perform_create(self, serializer):
        user = self.request.user
        try:
            # Находим все необходимые связанные сущности для установки значений по умолчанию.
            taxpayer = Taxpayer.objects.get(inn=user.username)
            default_status = ReportStatus.objects.get(pk=1)
            default_tax_officer = TaxOfficer.objects.get(pk=1)
            default_reduce_type = ReduceType.objects.get(pk=1)
            
            # Сохраняем заявление, передавая все обязательные, вычисляемые на сервере, поля.
            serializer.save(
                taxpayer=taxpayer,
                send_date=timezone.now(),
                request_status=default_status,
                tax_officer=default_tax_officer,
                reduce_type=default_reduce_type
            )
        except Taxpayer.DoesNotExist:
            raise serializers.ValidationError("Связанный налогоплательщик не найден.")
        except ReportStatus.DoesNotExist:
            raise serializers.ValidationError("Начальный статус для заявлений (ID=1) не найден.")
        except TaxOfficer.DoesNotExist:
            raise serializers.ValidationError("Сотрудник по умолчанию (ID=1) не найден.")
        except ReduceType.DoesNotExist:
            raise serializers.ValidationError("Тип снижения по умолчанию (ID=1) не найден.")
        

def _make_tokens_for_inn(inn: str, user_type: str):
    """
    Возвращает словарь с refresh и access токенами (строки).
    Мы не привязываем токен к Django User — добавляем нужные claim'ы.
    """
    refresh = RefreshToken()  # создаёт новый RefreshToken
    # кастомные claims:
    refresh['inn'] = inn
    refresh['user_type'] = user_type
    # access — вложенный токен:
    access = refresh.access_token
    return {
        'refresh': str(refresh),
        'access': str(access)
    }


class TaxpayerLoginAPIView(APIView):
    permission_classes = [permissions.AllowAny]

    def post(self, request):
        serializer = LoginSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        inn = serializer.validated_data['inn']
        password = serializer.validated_data['password']

        try:
            cred = TaxpayerAuth.objects.get(pk=inn)
        except TaxpayerAuth.DoesNotExist:
            return Response({'detail': 'Такой пользователь не найден'}, status=status.HTTP_401_UNAUTHORIZED)

        if not check_password(password, cred.password_hash):
            return Response({'detail': 'Неверный ИНН или пароль'}, status=status.HTTP_401_UNAUTHORIZED)

        tokens = _make_tokens_for_inn(inn, 'taxpayer')
        return Response({
                "refresh": tokens["refresh"],
                "access": tokens["access"],
                "role": "taxpayer"
            }, status=status.HTTP_200_OK)


class WorkerLoginAPIView(APIView):
    permission_classes = [permissions.AllowAny]

    def post(self, request):
        serializer = LoginSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        inn = serializer.validated_data['inn']
        password = serializer.validated_data['password']

        try:
            cred = WorkerAuth.objects.get(pk=inn)
        except WorkerAuth.DoesNotExist:
            return Response({'detail': 'Такой сотрудник не найден'}, status=status.HTTP_401_UNAUTHORIZED)

        if not check_password(password, cred.password_hash):
            return Response({'detail': 'Неверный ИНН или пароль'}, status=status.HTTP_401_UNAUTHORIZED)

        tokens = _make_tokens_for_inn(inn, 'worker')
        return Response({
                "refresh": tokens["refresh"],
                "access": tokens["access"],
                "role": "worker"
            }, status=status.HTTP_200_OK)
    

class CustomTokenRefreshView(TokenRefreshView):
    """
    Refresh, который возвращает access/refresh с inn и user_type.
    """
    def post(self, request, *args, **kwargs):
        refresh_token = request.data.get("refresh")

        if not refresh_token:
            return Response({"detail": "Refresh token отсутствует"}, status=400)

        try:
            refresh = RefreshToken(refresh_token)
        except Exception:
            return Response({"detail": "Неверный refresh токен"}, status=400)

        # старые claim'ы берём из refresh токена:
        inn = refresh.get("inn")
        user_type = refresh.get("user_type")

        if not inn or not user_type:
            return Response({"detail": "Refresh токен не содержит данные пользователя"}, status=400)

        # генерируем новый refresh
        new_refresh = RefreshToken()
        new_refresh["inn"] = inn
        new_refresh["user_type"] = user_type

        # новый access
        access = new_refresh.access_token

        return Response({
            "refresh": str(new_refresh),
            "access": str(access),
            "inn": inn,
            "user_type": user_type
        })