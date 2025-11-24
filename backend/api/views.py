from rest_framework import generics, status, serializers, permissions
from rest_framework.views import APIView
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from django.db import connection, transaction
from django.utils import timezone
from .models import (
    Taxpayer, TaxAccrual, TaxReduceRequest, ReduceBase, ReportStatus, 
    TaxOfficer, ReduceType, TaxpayerAuth, WorkerAuth, ObjectOwnership, 
    TaxPayment  # Убрали AccrualStatus из импорта
)
from .serializers import (
    TaxpayerSerializer,
    TaxAccrualSerializer,
    TaxReduceRequestSerializer,
    RiskScoreInputSerializer,
    RiskScoreOutputSerializer,
    ReduceBaseSerializer,
    LoginSerializer,
    ProfileSerializer,
    ChangePasswordSerializer,
    TaxReduceRequestListSerializer,
    ObjectOwnershipSerializer,
    TaxAccrualWithPaymentSerializer, 
    TaxPaymentSerializer, 
    PaymentCreateSerializer
)
from django.contrib.auth.hashers import check_password
from rest_framework_simplejwt.tokens import RefreshToken
from rest_framework_simplejwt.views import TokenRefreshView
from .authentication import InnAuthentication
from django.contrib.auth.hashers import check_password, make_password
from django.db.models import Sum


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
    
class CurrentTaxpayerAPIView(APIView):
    permission_classes = [IsAuthenticated]
    authentication_classes = [InnAuthentication]

    def get(self, request):
        user_inn = request.user.username
        try:
            taxpayer = Taxpayer.objects.get(inn=user_inn)
            return Response({
                'taxpayer_id': taxpayer.taxpayer_id,
                'inn': taxpayer.inn,
                'fio': taxpayer.fio,
                'full_name': taxpayer.full_name,
                'short_name': taxpayer.short_name,
                'payer_type_id': taxpayer.payer_type_id
            })
        except Taxpayer.DoesNotExist:
            return Response({'error': 'Налогоплательщик не найден'}, status=404)

class LatestRiskScoreAPIView(APIView):
    permission_classes = [IsAuthenticated]
    authentication_classes = [InnAuthentication]

    def get(self, request):
        user_inn = request.user.username
        try:
            # Находим налогоплательщика
            taxpayer = Taxpayer.objects.get(inn=user_inn)
            
            # Получаем последний RiskScore из таблицы taxpayer_rating
            with connection.cursor() as cursor:
                cursor.execute("""
                    SELECT rating_value 
                    FROM taxpayer_rating 
                    WHERE taxpayer_id = %s 
                    ORDER BY rating_date DESC 
                    LIMIT 1
                """, [taxpayer.taxpayer_id])
                result = cursor.fetchone()
                
            if result and result[0] is not None:
                risk_score_value = int(result[0]) if result[0] else 0
                return Response({'risk_score': risk_score_value})
            else:
                # Если нет записи, рассчитываем текущий RiskScore
                with connection.cursor() as cursor:
                    cursor.execute("SELECT calculate_risk_score(%s)", [taxpayer.taxpayer_id])
                    result = cursor.fetchone()
                    if result and result[0] is not None:
                        risk_score_value = int(result[0]) if result[0] else 0
                        return Response({'risk_score': risk_score_value})
                
                return Response({'risk_score': 0})
                
        except Taxpayer.DoesNotExist:
            return Response({'error': 'Налогоплательщик не найден'}, status=404)
        except Exception as e:
            return Response({'error': f'Ошибка: {str(e)}'}, status=500)
        

class ProfileDetailAPIView(APIView):
    permission_classes = [IsAuthenticated]
    authentication_classes = [InnAuthentication]

    def get(self, request):
        user_inn = request.user.username
        try:
            taxpayer = Taxpayer.objects.get(inn=user_inn)
            serializer = ProfileSerializer(taxpayer)
            return Response(serializer.data)
        except Taxpayer.DoesNotExist:
            return Response({'error': 'Налогоплательщик не найден'}, status=404)

class ChangePasswordAPIView(APIView):
    permission_classes = [IsAuthenticated]
    authentication_classes = [InnAuthentication]

    def post(self, request):
        user = request.user
        serializer = ChangePasswordSerializer(data=request.data)
        
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
        
        current_password = serializer.validated_data['current_password']
        new_password = serializer.validated_data['new_password']
        
        try:
            # Проверяем, является ли пользователь налогоплательщиком
            if user.user_type == 'taxpayer':
                auth_record = TaxpayerAuth.objects.get(inn=user.inn)
            elif user.user_type == 'worker':
                auth_record = WorkerAuth.objects.get(inn=user.inn)
            else:
                return Response({'error': 'Неизвестный тип пользователя'}, status=400)
            
            # Проверяем текущий пароль
            if not check_password(current_password, auth_record.password_hash):
                return Response(
                    {'error': 'Текущий пароль неверен'}, 
                    status=status.HTTP_400_BAD_REQUEST
                )
            
            # Обновляем пароль
            auth_record.password_hash = make_password(new_password)
            auth_record.save()
            
            return Response({'message': 'Пароль успешно изменен'})
            
        except (TaxpayerAuth.DoesNotExist, WorkerAuth.DoesNotExist):
            return Response({'error': 'Пользователь не найден'}, status=404)
        
class MyTaxReduceRequestsAPIView(generics.ListAPIView):
    serializer_class = TaxReduceRequestListSerializer
    permission_classes = [IsAuthenticated]
    authentication_classes = [InnAuthentication]
    
    def get_queryset(self):
        user = self.request.user
        user_inn = user.username
        return TaxReduceRequest.objects.filter(
            taxpayer__inn=user_inn
        ).order_by('-send_date')
    
class MyTaxableObjectsAPIView(generics.ListAPIView):
    serializer_class = ObjectOwnershipSerializer
    permission_classes = [IsAuthenticated]
    authentication_classes = [InnAuthentication]
    
    def get_queryset(self):
        user = self.request.user
        user_inn = user.username
        return ObjectOwnership.objects.filter(
            taxpayer__inn=user_inn
        ).select_related('object', 'object__object_type', 'object__real_estate_type')
    
class MyTaxAccrualsWithPaymentsAPIView(generics.ListAPIView):
    serializer_class = TaxAccrualWithPaymentSerializer
    permission_classes = [IsAuthenticated]
    authentication_classes = [InnAuthentication]
    
    def get_queryset(self):
        user = self.request.user
        user_inn = user.username
        return TaxAccrual.objects.filter(taxpayer__inn=user_inn)

class CreateTaxPaymentAPIView(APIView):
    permission_classes = [IsAuthenticated]
    authentication_classes = [InnAuthentication]

    def post(self, request):
        serializer = PaymentCreateSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
        
        try:
            with transaction.atomic():
                user_inn = request.user.username
                tax_accrual_id = serializer.validated_data['tax_accrual_id']
                payment_amount = serializer.validated_data['payment_amount']
                
                # Проверяем, что начисление принадлежит пользователю
                accrual = TaxAccrual.objects.get(
                    tax_accrual_id=tax_accrual_id,
                    taxpayer__inn=user_inn
                )
                
                # Получаем уже оплаченную сумму
                paid_amount = TaxPayment.objects.filter(
                    tax_income_id=tax_accrual_id
                ).aggregate(total=Sum('payment_amount'))['total'] or 0
                
                remaining_amount = accrual.accrual_amount - paid_amount
                
                # Проверяем, что сумма оплаты не превышает оставшуюся
                if payment_amount > remaining_amount:
                    return Response(
                        {'error': f'Сумма оплаты не может превышать {remaining_amount} руб.'},
                        status=status.HTTP_400_BAD_REQUEST
                    )
                
                if payment_amount <= 0:
                    return Response(
                        {'error': 'Сумма оплаты должна быть положительной'},
                        status=status.HTTP_400_BAD_REQUEST
                    )
                
                # Создаем платеж
                payment = TaxPayment.objects.create(
                    payment_date=timezone.now(),
                    payment_amount=payment_amount,
                    tax_income=accrual,
                    kbk_id=1,  # Значение по умолчанию
                    debit_account='',
                    credit_account=''
                )
                
                # Обновляем статус начисления после платежа
                self._update_accrual_status(accrual)
                
                return Response({
                    'message': 'Платеж успешно создан',
                    'payment_id': payment.payment_id,
                    'payment_amount': payment.payment_amount
                }, status=status.HTTP_201_CREATED)
                
        except TaxAccrual.DoesNotExist:
            return Response(
                {'error': 'Начисление не найдено или не принадлежит пользователю'},
                status=status.HTTP_404_NOT_FOUND
            )
        except Exception as e:
            return Response(
                {'error': f'Ошибка при создании платежа: {str(e)}'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )
    
    def _update_accrual_status(self, accrual):
        """Обновляет статус начисления на основе оплаченной суммы"""
        try:
            # Получаем текущую сумму всех платежей по этому начислению
            total_paid = TaxPayment.objects.filter(
                tax_income=accrual
            ).aggregate(total=Sum('payment_amount'))['total'] or 0
            
            # Определяем новый статус
            if total_paid >= accrual.accrual_amount:
                # Полностью оплачено
                new_status_id = 3
            elif total_paid > 0:
                # Частично оплачено
                new_status_id = 2
            else:
                # Не оплачено, проверяем просрочку
                if accrual.due_date and timezone.now().date() > accrual.due_date:
                    new_status_id = 4  # Просрочено
                else:
                    new_status_id = 1  # Начислено
            
            # Обновляем статус начисления
            accrual.accrual_status_id = new_status_id
            accrual.save()
            
        except Exception as e:
            # Логируем ошибку, но не прерываем выполнение
            print(f"Ошибка при обновлении статуса начисления: {str(e)}")

class MyTaxAccrualsWithPaymentsAPIView(generics.ListAPIView):
    serializer_class = TaxAccrualWithPaymentSerializer
    permission_classes = [IsAuthenticated]
    authentication_classes = [InnAuthentication]
    
    def get_queryset(self):
        user = self.request.user
        user_inn = user.username
        return TaxAccrual.objects.filter(taxpayer__inn=user_inn).select_related('object', 'object__object_type')