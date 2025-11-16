from rest_framework import generics, status, serializers
from rest_framework.views import APIView
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from django.db import connection
from django.utils import timezone
from .models import Taxpayer, TaxAccrual, TaxReduceRequest, ReduceBase, ReportStatus, TaxOfficer, ReduceType
from .serializers import (
    TaxpayerSerializer,
    TaxAccrualSerializer,
    TaxReduceRequestSerializer,
    RiskScoreInputSerializer,
    RiskScoreOutputSerializer,
    ReduceBaseSerializer
)

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
    def get_queryset(self):
        user = self.request.user
        user_inn = user.username
        return TaxAccrual.objects.filter(taxpayer__inn=user_inn)

class ReduceBaseListAPIView(generics.ListAPIView):
    queryset = ReduceBase.objects.all()
    serializer_class = ReduceBaseSerializer
    permission_classes = [IsAuthenticated]

# View для создания нового заявления.
class CreateTaxReduceRequestAPIView(generics.CreateAPIView):
    serializer_class = TaxReduceRequestSerializer
    permission_classes = [IsAuthenticated]

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