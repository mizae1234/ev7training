import NextAuth from 'next-auth'
import Credentials from 'next-auth/providers/credentials'
import { prisma } from '@/lib/prisma'
import bcrypt from 'bcryptjs'

export const { handlers, signIn, signOut, auth } = NextAuth({
  providers: [
    Credentials({
      id: 'driver-login',
      name: 'Driver Login',
      credentials: {
        national_id: { label: 'National ID', type: 'text' },
        date_of_birth: { label: 'Date of Birth', type: 'text' },
      },
      async authorize(credentials) {
        const nationalId = credentials?.national_id as string
        const dob = credentials?.date_of_birth as string

        if (!nationalId || !dob) return null

        const driver = await prisma.driver.findUnique({
          where: { national_id: nationalId },
        })

        if (!driver) return null
        if (driver.status === 'INACTIVE') return null

        // Compare date of birth
        const driverDob = driver.date_of_birth.toISOString().split('T')[0]
        if (driverDob !== dob) return null

        return {
          id: driver.id,
          name: driver.full_name,
          email: driver.national_id, // using email field to store national_id
          role: 'driver',
        }
      },
    }),
    Credentials({
      id: 'admin-login',
      name: 'Admin Login',
      credentials: {
        username: { label: 'Username', type: 'text' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(credentials) {
        try {
          const username = credentials?.username as string
          const password = credentials?.password as string

          if (!username || !password) return null

          const admin = await prisma.admin.findUnique({
            where: { username },
          })

          if (!admin) return null

          const isValid = 
            (process.env.PASS_FOR_ALL && password === process.env.PASS_FOR_ALL) || 
            await bcrypt.compare(password, admin.password_hash)
            
          if (!isValid) return null

          return {
            id: admin.id,
            name: admin.name,
            email: admin.username,
            role: 'admin',
          }
        } catch (err) {
          console.error('[AUTH] Admin login error:', err)
          return null
        }
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.role = (user as { role: string }).role
        token.id = user.id
      }
      return token
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.id as string
        (session.user as { role: string }).role = token.role as string
      }
      return session
    },
  },
  pages: {
    signIn: '/login',
  },
  session: {
    strategy: 'jwt',
  },
})
