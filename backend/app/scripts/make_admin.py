import asyncio
import os
from sqlalchemy import update
from app.db.session import async_session_local
from app.db.models import User

async def promote_to_admin():
    admin_email = os.getenv("ADMIN", "bgraphixx5@gmail.com")
    if not admin_email:
        print("No ADMIN_EMAIL provided.")
        return

    async with async_session_local() as session:
        result = await session.execute(
            update(User).where(User.email == admin_email).values(is_admin=True)
        )
        await session.commit()
        if result.rowcount > 0:
            print(f"Successfully ensured {admin_email} is an admin.")
        else:
            print(f"User with email {admin_email} not found yet (will promote when registered).")

if __name__ == "__main__":
    asyncio.run(promote_to_admin())
