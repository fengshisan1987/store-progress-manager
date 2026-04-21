#!/usr/bin/env python3
"""
门店筹建进度管理系统生成脚本
生成包含完整配置的 HTML 文件
"""

import argparse
import os
import shutil

def main():
    parser = argparse.ArgumentParser(description='生成门店筹建进度管理系统 HTML 文件')
    parser.add_argument('--output', '-o', default='进度管理系统.html', help='输出文件路径')
    args = parser.parse_args()
    
    # 获取 skill 目录
    skill_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    template_path = os.path.join(skill_dir, 'assets', 'template.html')
    
    # 检查模板文件是否存在
    if not os.path.exists(template_path):
        print(f"错误: 模板文件不存在: {template_path}")
        return 1
    
    # 复制模板到输出路径
    output_path = os.path.abspath(args.output)
    
    # 确保输出目录存在
    output_dir = os.path.dirname(output_path)
    if output_dir and not os.path.exists(output_dir):
        os.makedirs(output_dir)
    
    # 复制文件
    shutil.copy2(template_path, output_path)
    
    print(f"✅ 已生成门店筹建进度管理系统: {output_path}")
    print(f"📊 包含配置:")
    print(f"   - 7阶段39节点完整配置")
    print(f"   - 32家示例门店数据")
    print(f"   - 基本信息字段配置")
    print(f"   - 数据看板配置")
    print(f"   - 区域颜色区分")
    return 0

if __name__ == '__main__':
    exit(main())
