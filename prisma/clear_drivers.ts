import { PrismaClient } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'
import { Pool } from 'pg'

const pool = new Pool({ connectionString: process.env.DATABASE_URL })
const adapter = new PrismaPg(pool)
const prisma = new PrismaClient({ adapter })

async function main() {
  console.log('🧹 Starting cleanup process for Production...')

  // Step 1: Count before deletion
  const driverCount = await prisma.driver.count()
  const courseCount = await prisma.course.count()
  const questionCount = await prisma.question.count()
  const videoCount = await prisma.video.count()

  console.log(`\n📊 Status BEFORE cleanup:`)
  console.log(`- Drivers (and their progress): ${driverCount}`)
  console.log(`- Courses: ${courseCount}`)
  console.log(`- Questions: ${questionCount}`)
  console.log(`- Videos: ${videoCount}`)

  // Step 2: Delete all drivers
  if (driverCount > 0) {
    console.log('\n🗑️ Deleting all drivers...')
    const result = await prisma.driver.deleteMany({})
    console.log(`✅ Successfully deleted ${result.count} drivers.`)
  } else {
    console.log('\n✅ No drivers to delete.')
  }

  // Step 3: Verify deletion
  const postDriverCount = await prisma.driver.count()
  const postCourseCount = await prisma.course.count()
  
  console.log(`\n📊 Status AFTER cleanup:`)
  console.log(`- Drivers left: ${postDriverCount}`)
  console.log(`- Courses left: ${postCourseCount}`)

  if (postDriverCount === 0 && postCourseCount === courseCount) {
    console.log(`\n🎉 Success! Database is ready for Production.`)
  } else {
    console.log(`\n⚠️ Warning! Something might have gone wrong.`)
  }
}

main()
  .catch((e) => {
    console.error('❌ Error during cleanup:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
