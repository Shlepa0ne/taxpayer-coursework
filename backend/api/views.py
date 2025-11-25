from rest_framework import generics, status, serializers, permissions
from rest_framework.views import APIView
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from django.db import connection, transaction
from django.utils import timezone
from .models import (
    Taxpayer, TaxAccrual, TaxReduceRequest, ReduceBase, ReportStatus, 
    TaxOfficer, ReduceType, TaxpayerAuth, WorkerAuth, ObjectOwnership, 
    TaxPayment, TaxType, Declaration, TaxPeriod
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
    PaymentCreateSerializer,
    DeclarationSerializer,
    TaxTypeSerializer,
    DeclarationListSerializer,
    TaxPeriodSerializer
)
from django.contrib.auth.hashers import check_password
from rest_framework_simplejwt.tokens import RefreshToken
from rest_framework_simplejwt.views import TokenRefreshView
from .authentication import InnAuthentication
from django.contrib.auth.hashers import check_password, make_password
from django.db.models import Sum
from datetime import datetime


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
    authentication_classes = [InnAuthentication]

    def create(self, request, *args, **kwargs):
        # Получаем данные из запроса
        tax_types_data = request.data.get('tax_types', [])
        periods_data = request.data.get('periods', [])
        
        # Создаем копию данных для сериализатора
        serializer_data = request.data.copy()
        
        # Валидируем основными данными
        serializer = self.get_serializer(data=serializer_data)
        serializer.is_valid(raise_exception=True)
        
        try:
            with transaction.atomic():
                user = self.request.user
                taxpayer = Taxpayer.objects.get(inn=user.username)
                default_status = ReportStatus.objects.get(pk=1)
                default_tax_officer = TaxOfficer.objects.get(pk=1)
                reduce_type = ReduceType.objects.get(pk=request.data.get('reduce_type', 1))
                
                # Создаем заявление
                tax_reduce_request = TaxReduceRequest.objects.create(
                    taxpayer=taxpayer,
                    send_date=timezone.now(),
                    request_status=default_status,
                    tax_officer=default_tax_officer,
                    reduce_type=reduce_type,
                    requested_reduce_amount=serializer.validated_data['requested_reduce_amount'],
                    full_description=serializer.validated_data['full_description'],
                    reduce_base=serializer.validated_data['reduce_base']
                )
                
                # Создаем связи с типами налогов
                for tax_type_id in tax_types_data:
                    with connection.cursor() as cursor:
                        cursor.execute(
                            "INSERT INTO tax_reduce_request_tax_type (request_id, tax_type_id) VALUES (%s, %s)",
                            [tax_reduce_request.request_id, tax_type_id]
                        )
                
                # Создаем периоды и связи
                for period_data in periods_data:
                    start_date = period_data.get('start_date')
                    end_date = period_data.get('end_date')
                    
                    if start_date and end_date:
                        # Находим или создаем период
                        period = self.get_or_create_period(start_date, end_date)
                        
                        # Создаем связь с заявлением
                        with connection.cursor() as cursor:
                            cursor.execute(
                                "INSERT INTO rax_period_tax_reduce_request (period_id, request_id) VALUES (%s, %s)",
                                [period.period_id, tax_reduce_request.request_id]
                            )
                
                # Сериализуем ответ
                response_serializer = TaxReduceRequestSerializer(tax_reduce_request)
                headers = self.get_success_headers(response_serializer.data)
                return Response(response_serializer.data, status=status.HTTP_201_CREATED, headers=headers)
                
        except (Taxpayer.DoesNotExist, ReportStatus.DoesNotExist, 
                TaxOfficer.DoesNotExist, ReduceType.DoesNotExist) as e:
            return Response(
                {'error': str(e)}, 
                status=status.HTTP_400_BAD_REQUEST
            )
        except Exception as e:
            return Response(
                {'error': f'Ошибка при создании заявления: {str(e)}'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )
    
    def get_or_create_period(self, start_date, end_date):
        """Находит или создает период в таблице tax_period"""
        try:
            # Преобразуем строки в даты
            if isinstance(start_date, str):
                start_date = datetime.strptime(start_date, '%Y-%m-%d').date()
            if isinstance(end_date, str):
                end_date = datetime.strptime(end_date, '%Y-%m-%d').date()
            
            # Пытаемся найти существующий период
            period = TaxPeriod.objects.filter(
                start_date=start_date,
                end_date=end_date
            ).first()
            
            if period:
                return period
            
            # Определяем тип периода
            period_type_id = self.determine_period_type(start_date, end_date)
            
            # Создаем новый период
            period = TaxPeriod.objects.create(
                start_date=start_date,
                end_date=end_date,
                period_type_id=period_type_id
            )
            
            return period
            
        except Exception as e:
            # В случае ошибки создаем период с квартальным типом по умолчанию
            period = TaxPeriod.objects.create(
                start_date=start_date,
                end_date=end_date,
                period_type_id=2  # квартальный по умолчанию
            )
            return period
    
    def determine_period_type(self, start_date, end_date):
        """Определяет тип периода на основе дат"""
        from datetime import timedelta
        
        # Проверяем годовой период (с 1 января по 31 декабря)
        if (start_date.month == 1 and start_date.day == 1 and 
            end_date.month == 12 and end_date.day == 31):
            return 1  # годовой
        
        # Проверяем квартальные периоды
        quarters = [
            (1, 1, 31, 3),   # Q1: 1 янв - 31 мар
            (1, 4, 30, 6),   # Q2: 1 апр - 30 июн
            (1, 7, 30, 9),   # Q3: 1 июл - 30 сен
            (1, 10, 31, 12)  # Q4: 1 окт - 31 дек
        ]
        
        for quarter_start_day, quarter_start_month, quarter_end_day, quarter_end_month in quarters:
            if (start_date.month == quarter_start_month and start_date.day == quarter_start_day and
                end_date.month == quarter_end_month and end_date.day == quarter_end_day):
                return 2  # квартальный
        
        # Проверяем месячный период (разница в днях примерно 27-31 день)
        days_diff = (end_date - start_date).days
        if 27 <= days_diff <= 31:
            return 3  # месячный
        
        # По умолчанию считаем квартальным
        return 2
        

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
            # Используем rating_id для гарантии получения самой последней записи
            with connection.cursor() as cursor:
                cursor.execute("""
                    SELECT rating_value, rating_date 
                    FROM taxpayer_rating 
                    WHERE taxpayer_id = %s 
                    ORDER BY rating_id DESC 
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
        
class RiskScoreHistoryAPIView(APIView):
    permission_classes = [IsAuthenticated]
    authentication_classes = [InnAuthentication]

    def get(self, request):
        user_inn = request.user.username
        try:
            taxpayer = Taxpayer.objects.get(inn=user_inn)
            
            with connection.cursor() as cursor:
                cursor.execute("""
                    SELECT rating_id, rating_value, rating_date 
                    FROM taxpayer_rating 
                    WHERE taxpayer_id = %s 
                    ORDER BY rating_id DESC
                """, [taxpayer.taxpayer_id])
                results = cursor.fetchall()
                
            history = []
            for row in results:
                history.append({
                    'rating_id': row[0],
                    'risk_score': int(row[1]) if row[1] is not None else 0,
                    'rating_date': row[2]
                })
            
            return Response({'history': history})
            
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
        
        try:
            current_taxpayer = Taxpayer.objects.get(inn=user_inn)
            
            # Получаем начисления, где пользователь является налогоплательщиком
            taxpayer_accruals = TaxAccrual.objects.filter(taxpayer__inn=user_inn)
            
            # Получаем начисления от деклараций 6-НДФЛ, которые пользователь подал за других
            # Используем exclude вместо __ne
            declarant_accruals = TaxAccrual.objects.filter(
                declaration__who_declares=current_taxpayer
            ).exclude(declaration__taxpayer__inn=user_inn)  # Исключаем свои же 3-НДФЛ
            
            # Объединяем два QuerySet
            all_accruals = (taxpayer_accruals | declarant_accruals).distinct()
            
            return all_accruals.select_related(
                'object', 
                'object__object_type',
                'declaration',
                'declaration__taxpayer',
                'declaration__who_declares'
            ).order_by('-accrual_date')
            
        except Taxpayer.DoesNotExist:
            return TaxAccrual.objects.none()
        
class MyDeclarationsAPIView(generics.ListAPIView):
    serializer_class = DeclarationListSerializer
    permission_classes = [IsAuthenticated]
    authentication_classes = [InnAuthentication]
    
    def get_queryset(self):
        try:
            user = self.request.user
            user_inn = user.username
            taxpayer = Taxpayer.objects.get(inn=user_inn)
            
            return Declaration.objects.filter(
                who_declares=taxpayer
            ).select_related('tax_type', 'taxpayer', 'period').order_by('-submission_date')
            
        except Taxpayer.DoesNotExist:
            return Declaration.objects.none()
        except Exception as e:
            return Declaration.objects.none()
        
class CreateDeclarationAPIView(APIView):
    permission_classes = [IsAuthenticated]
    authentication_classes = [InnAuthentication]

    def post(self, request):
        serializer = DeclarationSerializer(data=request.data)
        
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
        
        try:
            user = self.request.user
            current_taxpayer = Taxpayer.objects.get(inn=user.username)
            
            declaration_type = serializer.validated_data.get('declaration_type')
            target_inn = serializer.validated_data.get('target_inn', '')
            tax_type = serializer.validated_data.get('tax_type')
            tax_sum = serializer.validated_data.get('tax_sum')
            total_income = serializer.validated_data.get('total_income')
            period_start = serializer.validated_data.get('period_start')
            period_end = serializer.validated_data.get('period_end')
            
            # Определяем taxpayer_id в зависимости от типа декларации
            if declaration_type == '3-NDFL':
                taxpayer = current_taxpayer
                who_declares = current_taxpayer
            elif declaration_type == '6-NDFL':
                if not target_inn:
                    return Response(
                        {'error': 'Для 6-НДФЛ необходимо указать ИНН налогоплательщика'}, 
                        status=status.HTTP_400_BAD_REQUEST
                    )
                
                try:
                    taxpayer = Taxpayer.objects.get(inn=target_inn)
                except Taxpayer.DoesNotExist:
                    return Response(
                        {'error': 'Налогоплательщик с указанным ИНН не найден'}, 
                        status=status.HTTP_404_NOT_FOUND
                    )
                who_declares = current_taxpayer
            else:
                return Response(
                    {'error': 'Неверный тип декларации'}, 
                    status=status.HTTP_400_BAD_REQUEST
                )
            
            # Находим или создаем период
            period = self.get_or_create_period(period_start, period_end)
            
            # Создаем декларацию
            declaration = Declaration.objects.create(
                taxpayer=taxpayer,
                who_declares=who_declares,
                tax_type=tax_type,
                tax_sum=tax_sum,
                total_income=total_income,
                submission_date=timezone.now(),
                period=period,
                declaration_status_id=2  # Статус "Подана"
            )
            
            response_serializer = DeclarationSerializer(declaration)
            return Response(response_serializer.data, status=status.HTTP_201_CREATED)
            
        except Taxpayer.DoesNotExist:
            return Response(
                {'error': 'Текущий налогоплательщик не найден'}, 
                status=status.HTTP_404_NOT_FOUND
            )
        except Exception as e:
            return Response(
                {'error': f'Ошибка при создании декларации: {str(e)}'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )
    
    def get_or_create_period(self, start_date, end_date):
        """Находит или создает период в таблице tax_period"""
        try:
            # Пытаемся найти существующий период
            period = TaxPeriod.objects.filter(
                start_date=start_date,
                end_date=end_date
            ).first()
            
            if period:
                return period
            
            # Определяем тип периода
            period_type_id = self.determine_period_type(start_date, end_date)
            
            # Создаем новый период
            period = TaxPeriod.objects.create(
                start_date=start_date,
                end_date=end_date,
                period_type_id=period_type_id
            )
            
            return period
            
        except Exception as e:
            # В случае ошибки создаем период с квартальным типом по умолчанию
            period = TaxPeriod.objects.create(
                start_date=start_date,
                end_date=end_date,
                period_type_id=2  # квартальный по умолчанию
            )
            return period
    
    def determine_period_type(self, start_date, end_date):
        """Определяет тип периода на основе дат"""
        from datetime import timedelta
        
        # Проверяем годовой период (с 1 января по 31 декабря)
        if (start_date.month == 1 and start_date.day == 1 and 
            end_date.month == 12 and end_date.day == 31):
            return 1  # годовой
        
        # Проверяем квартальные периоды
        quarters = [
            (1, 1, 31, 3),   # Q1: 1 янв - 31 мар
            (1, 4, 30, 6),   # Q2: 1 апр - 30 июн
            (1, 7, 30, 9),   # Q3: 1 июл - 30 сен
            (1, 10, 31, 12)  # Q4: 1 окт - 31 дек
        ]
        
        for quarter_start_day, quarter_start_month, quarter_end_day, quarter_end_month in quarters:
            if (start_date.month == quarter_start_month and start_date.day == quarter_start_day and
                end_date.month == quarter_end_month and end_date.day == quarter_end_day):
                return 2  # квартальный
        
        # Проверяем месячный период (разница в днях примерно 27-31 день)
        days_diff = (end_date - start_date).days
        if 27 <= days_diff <= 31:
            return 3  # месячный
        
        # По умолчанию считаем квартальным
        return 2
        
class TaxTypeListAPIView(generics.ListAPIView):
    queryset = TaxType.objects.all()
    serializer_class = TaxTypeSerializer
    permission_classes = [IsAuthenticated]
    authentication_classes = [InnAuthentication]

class CurrentWorkerAPIView(APIView):
    permission_classes = [IsAuthenticated]
    authentication_classes = [InnAuthentication]

    def get(self, request):
        user_inn = request.user.username
        try:
            worker_auth = WorkerAuth.objects.get(inn=user_inn)
            
            # Получаем связанного сотрудника через ForeignKey
            if worker_auth.tax_officer:
                tax_officer = worker_auth.tax_officer
                
                return Response({
                    'tax_officer_id': tax_officer.tax_officer_id,
                    'tax_officer_name': tax_officer.tax_officer_name,
                    'unit': tax_officer.unit or 'Не указано',
                    'role_id': tax_officer.role_id or 1
                })
            else:
                return Response({
                    'error': 'Профиль сотрудника не найден'
                }, status=404)
                
        except WorkerAuth.DoesNotExist:
            return Response({'error': 'Сотрудник не найден'}, status=404)

class AverageRiskScoreAPIView(APIView):
    permission_classes = [IsAuthenticated]
    authentication_classes = [InnAuthentication]

    def get(self, request):
        try:
            with connection.cursor() as cursor:
                cursor.execute("""
                    SELECT AVG(rating_value) 
                    FROM taxpayer_rating 
                    WHERE rating_value IS NOT NULL
                """)
                result = cursor.fetchone()
                
            average_score = result[0] if result and result[0] is not None else 0
            return Response({'average_score': round(average_score, 2)})
            
        except Exception as e:
            return Response({'error': f'Ошибка: {str(e)}'}, status=500)

class PendingRequestsCountAPIView(APIView):
    permission_classes = [IsAuthenticated]
    authentication_classes = [InnAuthentication]

    def get(self, request):
        try:
            count = TaxReduceRequest.objects.filter(
                request_status_id=1  # Статус "на рассмотрении"
            ).count()
            return Response({'count': count})
        except Exception as e:
            return Response({'error': f'Ошибка: {str(e)}'}, status=500)

class DeclarationsCountAPIView(APIView):
    permission_classes = [IsAuthenticated]
    authentication_classes = [InnAuthentication]

    def get(self, request):
        try:
            # Количество деклараций за текущий год
            from django.utils import timezone
            current_year = timezone.now().year
            
            count = Declaration.objects.filter(
                submission_date__year=current_year
            ).count()
            return Response({'count': count})
        except Exception as e:
            return Response({'error': f'Ошибка: {str(e)}'}, status=500)

class UpcomingInspectionsCountAPIView(APIView):
    permission_classes = [IsAuthenticated]
    authentication_classes = [InnAuthentication]

    def get(self, request):
        try:
            user_inn = request.user.username
            worker_auth = WorkerAuth.objects.get(inn=user_inn)
            
            # Используем ForeignKey связь через tax_officer
            if worker_auth.tax_officer:
                tax_officer_id = worker_auth.tax_officer.tax_officer_id
                
                with connection.cursor() as cursor:
                    cursor.execute("""
                        SELECT COUNT(*) 
                        FROM inspection i
                        INNER JOIN tax_officer_inspection toi ON i.inspection_id = toi.inspection_id
                        WHERE toi.tax_officer_id = %s 
                        AND i.inspection_date >= CURRENT_DATE
                        AND i.inspection_type_status_id = 1  -- Статус "запланирована"
                    """, [tax_officer_id])
                    result = cursor.fetchone()
                    
                count = result[0] if result else 0
                return Response({'count': count})
            else:
                # Если у сотрудника нет связанного tax_officer, возвращаем 0
                return Response({'count': 0})
                
        except WorkerAuth.DoesNotExist:
            return Response({'count': 0})
        except Exception as e:
            print(f"Error in upcoming inspections: {e}")
            # В случае любой ошибки возвращаем 0
            return Response({'count': 0})