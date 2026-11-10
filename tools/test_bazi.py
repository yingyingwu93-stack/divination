#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""八字命理 AI 输出完整性测试"""

import sys
import io
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')

from playwright.sync_api import sync_playwright
import time

def main():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page(viewport={'width': 390, 'height': 844})  # iPhone 14 尺寸

        # 1. 登录
        print("[1] 打开登录页...")
        page.goto('http://localhost:5001/auth.html')
        page.wait_for_load_state('networkidle')

        # 检查是否有登录表单
        username_input = page.locator('#login-username')
        password_input = page.locator('#login-password')

        if username_input.is_visible():
            print("[1] 填写登录信息...")
            username_input.fill('test_bazi')
            password_input.fill('test123456')

            # 点击登录按钮（文字是"登 录"）
            login_btn = page.locator('#login-form button')
            login_btn.click()
            page.wait_for_load_state('networkidle')
            time.sleep(2)
            print(f"[1] 登录后 URL: {page.url}")
        else:
            print("[1] 未找到登录表单，可能已登录")

        # 2. 打开八字页面
        print("[2] 打开八字页面...")
        page.goto('http://localhost:5001/bazi.html')
        page.wait_for_load_state('networkidle')
        time.sleep(1)

        # 3. 填写表单（默认值已经是 1995-06-15）
        print("[3] 填写出生信息...")
        page.fill('#bazi-year', '1995')
        page.fill('#bazi-month', '6')
        page.fill('#bazi-day', '15')
        page.select_option('#bazi-hour', '12')
        page.select_option('#bazi-gender', 'male')

        # 选择省份城市
        page.select_option('#bazi-province', index=0)  # 北京
        time.sleep(0.3)

        # 4. 点击排盘
        print("[4] 点击开始排盘...")
        start_btn = page.locator('.bazi-start-btn')
        start_btn.click()

        # 5. 等待排盘结果显示
        print("[5] 等待排盘结果...")
        page.wait_for_selector('#bazi-result.show', timeout=15000)
        time.sleep(2)  # 等待命盘渲染

        # 6. 等待 AI 分析完成
        print("[6] 等待 AI 分析完成（最多 120 秒）...")
        ai_section = page.locator('#bazi-ai-analysis')

        # 等待 loading 消失或内容出现
        max_wait = 120
        start_time = time.time()
        last_len = 0
        stable_count = 0

        while time.time() - start_time < max_wait:
            text = ai_section.inner_text()
            current_len = len(text)

            if '正在推演' not in text and current_len > 100:
                if current_len == last_len:
                    stable_count += 1
                    if stable_count >= 3:  # 连续 3 次长度不变，认为完成
                        break
                else:
                    stable_count = 0
            last_len = current_len
            time.sleep(2)

        # 7. 获取 AI 分析文本
        ai_text = ai_section.inner_text()
        print(f"[7] AI 分析文本长度: {len(ai_text)} 字符")
        print(f"[7] 等待用时: {time.time() - start_time:.1f} 秒")

        # 8. 检查 6 个部分是否存在
        sections = [
            ('日主强弱', '日主' in ai_text and ('强弱' in ai_text or '格局' in ai_text)),
            ('性格特征', '性格' in ai_text),
            ('事业财运', '事业' in ai_text or '财运' in ai_text),
            ('婚姻感情', '婚姻' in ai_text or '感情' in ai_text or '家庭' in ai_text),
            ('健康注意', '健康' in ai_text),
            ('五行开运', '开运' in ai_text or '五行' in ai_text),
        ]

        print("\n[8] 六个部分检查:")
        all_present = True
        for name, present in sections:
            status = "[OK]" if present else "[MISSING]"
            print(f"  {status} {name}")
            if not present:
                all_present = False

        # 9. 检查结尾是否完整
        print(f"\n[9] 输出结尾: ...{ai_text[-80:]}")

        # 10. 截图
        page.screenshot(path='D:/桌面/占卜/tools/bazi_result.png', full_page=True)
        print("\n[10] 截图已保存: tools/bazi_result.png")

        # 11. 输出完整文本到文件
        with open('D:/桌面/占卜/tools/bazi_output.txt', 'w', encoding='utf-8') as f:
            f.write(ai_text)
        print("[11] AI 输出已保存: tools/bazi_output.txt")

        if all_present:
            print("\n[PASS] 测试通过：六个部分全部存在")
        else:
            print("\n[FAIL] 测试失败：部分章节缺失")

        browser.close()

if __name__ == '__main__':
    main()
