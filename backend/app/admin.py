"""Promote an existing, verified account from a trusted server console."""
import argparse
from sqlalchemy import select
from .database import SessionLocal
from .models import User

if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('email')
    args = parser.parse_args()
    with SessionLocal() as db:
        user = db.scalar(select(User).where(User.email == args.email.lower()))
        if not user:
            raise SystemExit('Register this account first, then verify its owner before promotion.')
        user.is_admin = True
        db.commit()
        print('Administrator access granted to existing account.')
