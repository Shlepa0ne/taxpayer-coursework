# authentication.py
from rest_framework.authentication import BaseAuthentication
from rest_framework_simplejwt.tokens import AccessToken

class AuthenticatedUser:
    """
    Кастомный пользователь, который всегда считается аутентифицированным
    """
    def __init__(self, inn, user_type):
        self.username = inn
        self.inn = inn
        self.user_type = user_type
    
    @property
    def is_authenticated(self):
        return True

class InnAuthentication(BaseAuthentication):
    """
    Аутентификация по кастомному JWT, где есть только inn и user_type.
    """
    def authenticate(self, request):
        auth_header = request.headers.get('Authorization')
        
        if not auth_header or not auth_header.startswith('Bearer '):
            return None

        token_str = auth_header.split(' ')[1]

        try:
            token = AccessToken(token_str)
            inn = token.get('inn')
            user_type = token.get('user_type')
            
            if not inn or not user_type:
                return None

            # Создаем аутентифицированного пользователя
            user = AuthenticatedUser(inn, user_type)
            
            return (user, None)
            
        except Exception as e:
            return None