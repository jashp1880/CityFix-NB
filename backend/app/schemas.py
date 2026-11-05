from enum import Enum
from pydantic import BaseModel, EmailStr, Field, ConfigDict


class Category(str, Enum):
    road = 'road'
    sidewalk = 'sidewalk'
    lighting = 'lighting'
    waste = 'waste'
    water = 'water'
    accessibility = 'accessibility'
    other = 'other'


class Severity(str, Enum):
    low = 'low'
    medium = 'medium'
    high = 'high'


class Status(str, Enum):
    submitted = 'submitted'
    reviewing = 'reviewing'
    in_progress = 'in_progress'
    resolved = 'resolved'
    rejected = 'rejected'


class Jurisdiction(str, Enum):
    city = 'new_brunswick'
    rutgers = 'rutgers'


class Register(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True)
    email: EmailStr
    name: str = Field(min_length=2, max_length=80)
    password: str = Field(min_length=12, max_length=128)


class Login(BaseModel):
    email: EmailStr
    password: str = Field(min_length=1, max_length=128)


class Profile(BaseModel):
    name: str = Field(min_length=2, max_length=80)


class UpdateStatus(BaseModel):
    status: Status
    note: str = Field(min_length=3, max_length=1000)
    route_approved: bool = False


class Suggestion(BaseModel):
    category: Category
    severity: Severity
    title: str = Field(min_length=3, max_length=120)
    description: str = Field(min_length=10, max_length=4000)
